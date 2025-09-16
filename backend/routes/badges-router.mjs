import express from "express";
import { Pool } from "pg";
import { enforceWhitelist, isKnownSector } from '../config/sectors.mjs';


const router = express.Router();

// Body parser local (au cas oÃ¹ il n'est pas global)
// Sans effet secondaire si dÃ©jÃ  appliquÃ© au niveau app.
router.use(express.json({ limit: "256kb" }));

// Pool PG minimal (reutilise DATABASE_URL existant)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

// Validation utilitaires
const isUUID = (v) => typeof v === "string" && /^[0-9a-fA-F-]{36}$/.test(v);
const bad = (errors) => ({ errors });

/**
 * POST /api/badges/request
 * Body: { consumer_id: uuid, sector: string(1..50), proof?: object }
 * Effet: insÃ¨re un badge en status 'requested'
 * 201: { ok:true, badge:{ id, consumer_id, sector, status, requested_at } }
 * 400: { errors:[{field,msg},...] }
 * 409: conflit unicitÃ© active (consumer_id, sector)
 */
router.post("/api/badges/request", async (req, res) => {
  const { consumer_id, sector, proof } = req.body ?? {};

  const errors = [];
  if (enforceWhitelist && !(typeof sector === 'string' && isKnownSector(sector))) { errors.push({ field: 'sector', msg: 'unknown sector' }); }
  if (!isUUID(consumer_id)) errors.push({ field: "consumer_id", msg: "consumer_id must be a UUID" });
  if (!(typeof sector === "string" && sector.length >= 1 && sector.length <= 50))
    errors.push({ field: "sector", msg: "sector must be 1-50 chars" });
  if (proof !== undefined && (typeof proof !== "object" || proof === null))
    errors.push({ field: "proof", msg: "proof must be an object" });

  if (errors.length) return res.status(400).json(bad(errors));

  let client;
  try {
    client = await pool.connect();
    const sql = `
      INSERT INTO badges (consumer_id, sector, proof_json)
      VALUES ($1, $2, COALESCE($3::jsonb, '{}'::jsonb))
      RETURNING id, consumer_id, sector, status, requested_at
    `;
    const vals = [consumer_id, sector, proof ? JSON.stringify(proof) : null];
    const r = await client.query(sql, vals);
    return res.status(201).json({ ok: true, badge: r.rows[0] });
  } catch (e) {
    // 23505 = unique_violation (ux_badges_active)
    if (e && e.code === "23505") {
      return res.status(409).json(
        bad([{ field: "sector", msg: "active badge already exists for this consumer and sector" }])
      );
    }
    console.error("POST /api/badges/request", e);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    if (client) client.release();
  }
});

/**
 * POST /api/badges/verify  (DEV)
 * Body: { badge_id: uuid }
 * Effet: passe le badge en 'verified' (les triggers rempliront verified_at et loggeront la vérification).
 * Sécurité: autorisé seulement si NODE_ENV !== 'production' ou ALLOW_DEV_VERIFY === 'true'.
 */
router.post("/api/badges/verify", async (req, res) => {
  const { badge_id } = req.body ?? {};
  const errors = [];
  if (enforceWhitelist && !(typeof sector === 'string' && isKnownSector(sector))) { errors.push({ field: 'sector', msg: 'unknown sector' }); }
  if (!isUUID(badge_id)) errors.push({ field: "badge_id", msg: "badge_id must be a UUID" });
  if (errors.length) return res.status(400).json(bad(errors));

  const devAllowed = process.env.ALLOW_DEV_VERIFY === "true" || process.env.NODE_ENV !== "production";
  if (!devAllowed) return res.status(403).json({ error: "forbidden_dev_verify" });

  let client;
  try {
    client = await pool.connect();
    const sql = `
      UPDATE badges
         SET status = 'verified'
       WHERE id = $1
       RETURNING id, consumer_id, sector, status, requested_at, verified_at
    `;
    const r = await client.query(sql, [badge_id]);
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true, badge: r.rows[0] });
  } catch (e) {
    console.error("POST /api/badges/verify", e);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    if (client) client.release();
  }
});

export default router;

