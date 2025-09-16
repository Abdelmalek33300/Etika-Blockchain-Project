import express from "express";
import { Pool } from "pg";
import { requireAuth, requireAdmin } from '../services/jwt.js';
const router = express.Router();

router.use(requireAuth, requireAdmin);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

/** Auth admin via JWT (HS256, rÃ´le "admin") */
/** GET /api/admin/badges?status=&sector=&consumer_id=&page=&limit=&sort=&order= */
router.get('/api/admin/badges', async (req, res) => {
  const q = req.query || {};
  const status = typeof q.status === "string" ? q.status : null; // requested|verified|rejected|revoked
  const sector = typeof q.sector === "string" ? q.sector : null;
  const consumer_id = typeof q.consumer_id === "string" ? q.consumer_id : null;

  const page = Math.max(1, parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? "20", 10) || 20));
  const offset = (page - 1) * limit;

  const SORT_WHITELIST = new Set(["requested_at","verified_at","sector","status"]);
  const sort = SORT_WHITELIST.has(String(q.sort || "")) ? String(q.sort) : "requested_at";
  const order = String(q.order || "desc").toLowerCase() === "asc" ? "asc" : "desc";

  const where = [];
  const vals = [];
  let i = 1;

  if (status) { where.push(`status = $${i++}`); vals.push(status); }
  if (sector) { where.push(`sector = $${i++}`); vals.push(sector); }
  if (consumer_id) { where.push(`consumer_id = $${i++}`); vals.push(consumer_id); }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sql = `
    SELECT id, consumer_id, sector, status, requested_at, verified_at, verifier_id, note,
           COUNT(*) OVER() AS total
    FROM badges
    ${whereSql}
    ORDER BY ${sort} ${order}
    LIMIT $${i++} OFFSET $${i++}
  `;
  vals.push(limit, offset);

  let client;
  try {
    client = await pool.connect();
    const r = await client.query(sql, vals);
    const total = r.rows[0]?.total ? Number(r.rows[0].total) : 0;
    return res.json({
      ok: true,
      page, limit, total,
      items: r.rows.map(({ total, ...rest }) => rest),
    });
  } catch (e) {
    console.error("GET /api/admin/badges", e);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    if (client) client.release();
  }
});

/** PATCH /api/admin/badges/:id/verify  Body: { approved:boolean, note?:string } */
router.patch('/api/admin/badges/:id/verify', async (req, res) => {
  const id = req.params.id;
  const { approved, note } = req.body ?? {};

  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return res.status(400).json({ errors: [{ field: "id", msg: "id must be UUID" }] });
  }
  if (typeof approved !== "boolean") {
    return res.status(400).json({ errors: [{ field: "approved", msg: "approved must be boolean" }] });
  }
  const newStatus = approved ? "verified" : "rejected";

  const sql = `
    UPDATE badges
       SET status = $2,
           verifier_id = $3,
           note = COALESCE($4, note)
     WHERE id = $1
     RETURNING id, consumer_id, sector, status, requested_at, verified_at, verifier_id, note
  `;
  const vals = [id, newStatus, (req.user?.sub || req.user?.id || null), note ?? null];

  let client;
  try {
    client = await pool.connect();
    const r = await client.query(sql, vals);
    if (r.rowCount === 0) return res.status(404).json({ error: "not_found" });
    return res.json({ ok: true, badge: r.rows[0] });
  } catch (e) {
    console.error("PATCH /api/admin/badges/:id/verify", e);
    return res.status(500).json({ error: "internal_error" });
  } finally {
    if (client) client.release();
  }
});

export default router;
