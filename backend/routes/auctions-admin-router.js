// routes/auctions-admin-router.js — ESM
// Admin: créer une enchère, supprimer (si AUCUN bid), ou ARCHIVER (soft-delete).
// PATCH /:id/archive  => status='archived', archived_at=now()
// DELETE /:id         => si bids>0 => 409 + message d'utiliser PATCH archive
// POST /              => création simple (title, sector)

import express from 'express';
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import { body, param, validationResult } from 'express-validator';

const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// ——— Auth minimale via JWT (signature) ———
function requireAuth(req, res, next) {
  try {
    const h = req.headers['authorization'] || '';
    const m = h.match(/^Bearer\s+(.+)/i);
    if (!m) return res.status(401).json({ error: 'Missing Bearer token' });
    const token = m[1];
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ——— Validators ———
const postValidators = [
  body('title').isString().trim().isLength({ min: 1 }).withMessage('title required'),
  body('sector').isString().trim().isLength({ min: 1 }).withMessage('sector required'),
];
const idParam = [param('id').isString().isLength({ min: 1 })];

function ensureValid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array().map(e => ({ field: e.param, msg: e.msg })) });
  }
  return null;
}

// ——— POST /api/admin/auctions — créer ———
router.post('/', requireAuth, postValidators, async (req, res, next) => {
  try {
    const invalid = ensureValid(req, res); if (invalid) return;
    const { title, sector } = req.body;
    const sql = `
      INSERT INTO auctions (title, sector, status)
      VALUES ($1, $2, 'active')
      RETURNING id, title, sector, status, created_at
    `;
    const { rows } = await pool.query(sql, [title, sector]);
    return res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ——— DELETE /api/admin/auctions/:id — supprimer si aucun bid ———
router.delete('/:id', requireAuth, idParam, async (req, res, next) => {
  try {
    const invalid = ensureValid(req, res); if (invalid) return;
    const { id } = req.params;

    const cntQ = await pool.query('SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1', [id]);
    const n = cntQ.rows[0]?.n ?? 0;
    if (n > 0) {
      return res.status(409).json({
        error: 'auction_has_bids',
        message: 'Cette enchère a des bids. Utilisez PATCH /api/admin/auctions/:id/archive (soft-delete).',
        bids_count: n,
      });
    }

    const del = await pool.query('DELETE FROM auctions WHERE id = $1', [id]);
    if (del.rowCount === 0) return res.status(404).json({ error: 'not_found' });
    return res.status(204).send();
  } catch (err) { next(err); }
});

// ——— PATCH /api/admin/auctions/:id/archive — soft-delete ———
router.patch('/:id/archive', requireAuth, idParam, async (req, res, next) => {
  try {
    const invalid = ensureValid(req, res); if (invalid) return;
    const { id } = req.params;

    const upd = await pool.query(
      `UPDATE auctions
         SET status = 'archived', archived_at = NOW()
       WHERE id = $1
       RETURNING id, title, sector, status, archived_at, created_at`,
      [id]
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: 'not_found' });
    return res.json({ ok: true, auction: upd.rows[0] });
  } catch (err) { next(err); }
});

export default router;
