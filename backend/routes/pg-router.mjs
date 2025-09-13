// routes/pg-router.mjs — ESM v4
// - Pagination + tri (auctions & bids)
// - Filtre de statut: par défaut on EXCLUT les 'archived'
//   • ?status=all            -> pas de filtre
//   • ?status=active|draft|closed|archived -> filtre exact
//   • meta.status: "not_archived" | "all" | l'un des statuts

import express from 'express';
import pkg from 'pg';

const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

console.log('[PG-ROUTER] v4 loaded (pagination+sorting+status filter)');

// ——— Utils ———
function toInt(v, def, { min = 1, max = 100 } = {}) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}
function toOrder(v, def = 'DESC') {
  const s = String(v || def).toUpperCase();
  return s === 'ASC' ? 'ASC' : 'DESC';
}

const AUCTION_SORTS = {
  created_at: 'a.created_at',
  title: 'a.title',
  sector: 'a.sector',
  bids_count: 'b.cnt',
};
const BID_SORTS = {
  amount_cents: 'amount_cents',
  created_at: 'created_at',
};

const STATUS_LIST = ['active', 'draft', 'closed', 'archived'];

function buildWhereForStatus(statusRaw) {
  // statusRaw: string or undefined
  const s = (statusRaw || '').toLowerCase();
  if (s === 'all') return { clause: '', params: [], meta: 'all' };
  if (STATUS_LIST.includes(s)) return { clause: 'WHERE a.status = $1', params: [s], meta: s };
  // défaut : exclure archivées (NULL traité comme 'active')
  return { clause: "WHERE COALESCE(a.status,'active') <> 'archived'", params: [], meta: 'not_archived' };
}

// ——— GET /api/auctions — pagination + tri + filtre status ———
// Query : ?page=&limit=&sort=(created_at|title|sector|bids_count)&order=(asc|desc)&status=(all|active|draft|closed|archived)
router.get('/auctions', async (req, res, next) => {
  try {
    const page = toInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit = toInt(req.query.limit, 10, { min: 1, max: 100 });
    const sortKey = String(req.query.sort || 'created_at').toLowerCase();
    const order = toOrder(req.query.order, 'ASC'); // par défaut croissant
    const sortCol = AUCTION_SORTS[sortKey] || AUCTION_SORTS.created_at;
    const { clause, params, meta } = buildWhereForStatus(req.query.status);
    const offset = (page - 1) * limit;

    // Total filtré
    const totalQ = await pool.query(`SELECT COUNT(*)::int AS n FROM auctions a ${clause}`, params);
    const total = totalQ.rows[0]?.n ?? 0;

    // Items filtrés + triés
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
      status: meta,               // "not_archived" | "all" | exact
      items: rows,
    });
  } catch (err) {
    next(err);
  }
});

// ——— GET /api/bids/:auctionId — pagination + tri ———
// Query : ?page=&limit=&sort=(amount_cents|created_at)&order=(asc|desc)
router.get('/bids/:auctionId', async (req, res, next) => {
  try {
    const { auctionId } = req.params;
    const page = toInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit = toInt(req.query.limit, 10, { min: 1, max: 100 });
    const sortKey = String(req.query.sort || 'amount_cents').toLowerCase();
    const order = toOrder(req.query.order, 'DESC'); // défaut montant décroissant
    const sortCol = BID_SORTS[sortKey] || BID_SORTS.amount_cents;
    const offset = (page - 1) * limit;

    const totalQ = await pool.query(
      'SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1',
      [auctionId]
    );
    const total = totalQ.rows[0]?.n ?? 0;

    const sql = `
      SELECT id, auction_id, amount_cents, created_at
      FROM bids
      WHERE auction_id = $1
      ORDER BY ${sortCol} ${order}
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await pool.query(sql, [auctionId, limit, offset]);

    const pages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      total, page, pages, limit,
      sort: sortKey in BID_SORTS ? sortKey : 'amount_cents',
      order: order.toLowerCase(),
      items: rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
