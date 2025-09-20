import express from "express";
import { Pool } from "pg";

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

/**
 * GET /api/public/counters
 * Réponse: { ok, threshold, total_badges, percent, per_sector }
 */
router.get("/api/public/counters", async (req, res) => {
  const thrRaw = process.env.LAUNCH_THRESHOLD;
  const threshold = Number.isFinite(parseInt(thrRaw, 10)) ? parseInt(thrRaw, 10) : 100000;

  let client;
  try {
    client = await pool.connect();
    const r = await client.query("SELECT total_badges, per_sector FROM vw_badges_counters");
    const row = r.rows[0] || { total_badges: 0, per_sector: {} };

    const total_badges = Number(row.total_badges) || 0; // Cast au cas où PG renvoie du texte
    const per_sector = row.per_sector || {};
    const percent = threshold > 0 ? +((total_badges / threshold) * 100).toFixed(2) : 0;

    return res.json({ ok: true, threshold, total_badges, percent, per_sector });
  } catch (e) {
    console.error("/api/public/counters", e);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    if (client) client.release();
  }
});

export default router;