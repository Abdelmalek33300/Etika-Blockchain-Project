/* routes/pg-router.mjs  ESM v5.1
 * - /public/counters (seuil/compteur)
 * - /auctions : pagination + tri + filtre status (archived masquées par défaut)
 * - /bids/:auctionId : pagination + tri
 */

import express from 'express';
import pkg from 'pg';

const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

console.log('[PG-ROUTER] v5.1 loaded (counters + status filter)');

//  Utils communs 
function toInt(v, def, { min = 1, max = 100 } = {}) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}
function toOrder(v, def = 'DESC') {
  const s = String(v || def).toUpperCase();
  return s === 'ASC' ? 'ASC' : 'DESC';
}

//  /public/counters 
// Renvoie { threshold, total_badges, percent, per_sector[] }.
// Si la table badges n'existe pas encore: total=0, per_sector=[]
router.get('/public/counters', async (req, res, next) => {
  try {
    const THRESHOLD = parseInt(process.env.LAUNCH_THRESHOLD || '100000', 10) || 100000;

    const hasBadges = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema='public' AND table_name='badges'
       ) AS exists`
    );
    if (!hasBadges.rows[0]?.exists) {
      return res.json({
        threshold: THRESHOLD,
        total_badges: 0,
        percent: 0,
        per_sector: [],
      });
    }

    const totalQ = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM badges
        WHERE COALESCE(status,'active')='active'`
    );
    const total = totalQ.rows[0]?.n ?? 0;

    const hasSector = await pool.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema='public'
           AND table_name='badges'
           AND column_name='sector'
       ) AS exists`
    );

    let per_sector = [];
    if (hasSector.rows[0]?.exists) {
      const perQ = await pool.query(
        `SELECT COALESCE(sector,'unknown') AS sector, COUNT(*)::int AS n
           FROM badges
          WHERE COALESCE(status,'active')='active'
          GROUP BY 1
          ORDER BY n DESC`
      );
      per_sector = perQ.rows;
    }

    const percent = THRESHOLD > 0 ? Math.min(100, Math.floor((total * 100) / THRESHOLD)) : 0;

    return res.json({
      threshold: THRESHOLD,
      total_badges: total,
      percent,
      per_sector,
    });
  } catch (err) {
    next(err);
  }
});

//  Auctions publiques 
const AUCTION_SORTS = {
  created_at: 'a.created_at',
  title: 'a.title',
  sector: 'a.sector',
  bids_count: 'b.cnt',
};
const STATUS_LIST = ['active', 'draft', 'closed', 'archived'];

function buildWhereForStatus(statusRaw) {
  const s = (statusRaw || '').toLowerCase();
  if (s === 'all') return { clause: '', params: [], meta: 'all' };
  if (STATUS_LIST.includes(s)) return { clause: 'WHERE a.status = $1', params: [s], meta: s };
  return { clause: "WHERE COALESCE(a.status,'active') <> 'archived'", params: [], meta: 'not_archived' };
}

// GET /api/auctions
router.get('/auctions', async (req, res, next) => {
  try {
    const page = toInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit = toInt(req.query.limit, 10, { min: 1, max: 100 });
    const sortKey = String(req.query.sort || 'created_at').toLowerCase();
    const order = toOrder(req.query.order, 'ASC');
    const sortCol = AUCTION_SORTS[sortKey] || AUCTION_SORTS.created_at;
    const { clause, params, meta } = buildWhereForStatus(req.query.status);
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
      status: meta,
      items: rows,
    });
  } catch (err) {
    next(err);
  }
});

//  Bids publiques 
const BID_SORTS = {
  amount_cents: 'amount_cents',
  created_at: 'created_at',
};

// GET /api/bids/:auctionId
router.get('/bids/:auctionId', async (req, res, next) => {
  try {
    const { auctionId } = req.params;
    const page = toInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit = toInt(req.query.limit, 10, { min: 1, max: 100 });
    const sortKey = String(req.query.sort || 'amount_cents').toLowerCase();
    const order = toOrder(req.query.order, 'DESC');
    const sortCol = BID_SORTS[sortKey] || BID_SORTS.amount_cents;
    const offset = (page - 1) * limit;

    const totalQ = await pool.query('SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1', [auctionId]);
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
