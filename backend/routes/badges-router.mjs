import express from "express";

import rateLimit from 'express-rate-limit';
import { Pool } from "pg";
import { signToken } from '../services/jwt.js';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { enforceWhitelist, isKnownSector } from '../config/sectors.mjs';


const router = express.Router();

// Body parser local (au cas oÃ¹ il n'est pas global)
// Sans effet secondaire si dÃ©jÃ  appliquÃ© au niveau app.
router.use(express.json({ limit: "256kb" }));


const requestEmailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,                    // 5 requêtes max / fenêtre / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too_many_requests" },
});
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

/**
 * POST /api/badges/request-email
 * Body: { email:string, sector:string }
 * Dev: renvoie aussi magic_link (non-prod) pour cliquer et valider.
 */
router.post("/api/badges/request-email", requestEmailLimiter, async (req, res) => {
  const { email, sector } = req.body ?? {};
  const errors = [];
  const validEmail = (v) => typeof v === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

  if (!validEmail(email)) errors.push({ field: "email", msg: "invalid email" });
  if (!(typeof sector === "string" && sector.length >= 1 && sector.length <= 50))
    errors.push({ field: "sector", msg: "sector must be 1-50 chars" });
  if (enforceWhitelist && !(typeof sector === "string" && isKnownSector(sector)))
    errors.push({ field: "sector", msg: "unknown sector" });

  if (errors.length) return res.status(400).json(bad(errors));

  let client;
  try {
    client = await pool.connect();

    // 1) existe déjà (email+sector, actif) ?
    const findSql = `
      SELECT id, consumer_id, sector, status, requested_at, verified_at, email
        FROM badges
       WHERE sector = $1 AND email = $2
         AND status IN ('requested','verified')
       ORDER BY requested_at DESC
       LIMIT 1`;
    const f = await client.query(findSql, [sector, email]);
    let badge;

    if (f.rowCount > 0) {
      badge = f.rows[0];
    } else {
      // 2) créer un badge "requested"
      const sql = `
        INSERT INTO badges (id, consumer_id, sector, status, email, proof_json)
        VALUES ($1, $2, $3, 'requested', $4, COALESCE($5::jsonb, '{}'::jsonb))
        RETURNING id, consumer_id, sector, status, requested_at, verified_at, email
      `;
      const id = randomUUID();
      const consumer_id = randomUUID();
      const proof = { source: "request-email" };
      const r = await client.query(sql, [id, consumer_id, sector, email, JSON.stringify(proof)]);
      badge = r.rows[0];
    }

    // 3) magic link 24h
    const token = signToken({ kind: "email-verify", badge_id: badge.id, email }, "24h");
    const magic_link = `https://localhost:4443/api/badges/verify-email?token=${encodeURIComponent(token)}`;

    const out = { ok: true, badge };
    if (process.env.NODE_ENV !== "production") out.magic_link = magic_link;
    return res.json(out);
  } catch (e) {
    console.error("POST /api/badges/request-email", e);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    if (client) client.release();
  }
});

/**
 * GET /api/badges/verify-email?token=...
 * Effet: passe le badge "verified" + renseigne email_verified_at.
 */
router.get("/api/badges/verify-email", async (req, res) => {
  const token = req.query?.token;
  if (!token) return res.status(400).json({ error: "missing_token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || payload.kind !== "email-verify" || !payload.badge_id || !payload.email) {
      return res.status(400).json({ error: "invalid_token" });
    }

    let client;
    try {
      client = await pool.connect();
      const upd = await client.query(
        `UPDATE badges
            SET status = 'verified',
                email_verified_at = COALESCE(email_verified_at, now())
          WHERE id = $1 AND email = $2
          RETURNING id, consumer_id, sector, status, requested_at, verified_at, email, email_verified_at`,
        [payload.badge_id, payload.email]
      );
      if (upd.rowCount === 0) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, badge: upd.rows[0] });
    } finally {
      if (client) client.release();
    }
  } catch (e) {
    console.error("GET /api/badges/verify-email", e);
    return res.status(400).json({ error: "invalid_or_expired_token" });
  }
});
export default router;










