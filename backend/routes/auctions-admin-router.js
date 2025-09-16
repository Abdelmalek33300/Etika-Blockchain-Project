// routes/auctions-admin-router.js — ESM (admin)
// Admin: GET (liste paginée/triée avec filtre status), POST (création),
// DELETE (autorisé seulement si 0 bid), PATCH /:id/archive (soft-delete)

import express from 'express';
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import { body, param, query, validationResult } from 'express-validator';

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
    req.user = payload; // sub/role si besoin
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ——— Helpers / validation ———
function ensureValid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array().map(e => ({ field: e.param, msg: e.msg })) });
  }
  return null;
}
function toInt(v, def, { min = 1, max = 100 } = {}) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}
function toOrder(v, def = 'DESC') {
  const s = String(v || def).toUpperCase();
  return s === 'ASC' ? 'ASC' : 'DESC';
}

const STATUS_LIST = ['active', 'draft', 'closed', 'archived'];
const AUCTION_SORTS = {
  created_at: 'a.created_at',
  title: 'a.title',
  sector: 'a.sector',
  status: 'a.status',
  archived_at: 'a.archived_at',
  bids_count: 'b.cnt',
};

// ——— GET /api/admin/auctions — liste admin paginée/triée + filtre status ———
// Par défaut côté admin: status=all (on veut tout voir)
// Query : ?page=&limit=&sort=(created_at|title|sector|status|archived_at|bids_count)&order=(asc|desc)&status=(all|active|draft|closed|archived)
const listValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(Object.keys(AUCTION_SORTS)),
  query('order').optional().isIn(['asc', 'desc']),
  query('status').optional().isIn(['all', ...STATUS_LIST]),
];

router.get('/', requireAuth, listValidators, async (req, res, next) => {
  try {
    const invalid = ensureValid(req, res); if (invalid) return;

    const page = toInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit = toInt(req.query.limit, 10, { min: 1, max: 100 });
    const sortKey = String(req.query.sort || 'created_at').toLowerCase();
    const order = toOrder(req.query.order, 'DESC'); // admin par défaut décroissant
    const sortCol = AUCTION_SORTS[sortKey] || AUCTION_SORTS.created_at;
    const st = String(req.query.status || 'all').toLowerCase();

    let clause = '';
    const params = [];
    if (st !== 'all') {
      clause = 'WHERE a.status = $1';
      params.push(st);
    }

    const offset = (page - 1) * limit;

    const totalQ = await pool.query(`SELECT COUNT(*)::int AS n FROM auctions a ${clause}`, params);
    const total = totalQ.rows[0]?.n ?? 0;

    const sql = `
      SELECT a.id, a.title, a.sector, a.created_at, a.status, a.archived_at, COALESCE(b.cnt,0) AS bids_count
      FROM auctions a
      LEFT JOIN (
        SELECT auction_id, COUNT(*)::int AS cnt
        FROM bids
        GROUP BY auction_id
      ) b ON b.auction_id = a.id
      ${clause}
      ORDER BY ${sortCol} ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const { rows } = await pool.query(sql, [...params, limit, offset]);

    const pages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      total, page, pages, limit,
      sort: sortKey in AUCTION_SORTS ? sortKey : 'created_at',
      order: order.toLowerCase(),
      status: st, // "all" | exact
      items: rows,
    });
  } catch (err) { next(err); }
});

// ——— POST /api/admin/auctions — créer ———
const postValidators = [
  body('title').isString().trim().isLength({ min: 1 }).withMessage('title required'),
  body('sector').isString().trim().isLength({ min: 1 }).withMessage('sector required'),
];
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
router.delete('/:id', requireAuth, [param('id').isString().isLength({ min: 1 })], async (req, res, next) => {
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
router.patch('/:id/archive', requireAuth, [param('id').isString().isLength({ min: 1 })], async (req, res, next) => {
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

