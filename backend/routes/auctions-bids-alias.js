// routes/auctions-bids-alias.js (ESM, corrigé)
// Alias public : /api/auctions/:id/bids
// Utilise amount_cents (colonne réelle) et expose aussi amount (euros) pour compatibilité.

import express from 'express';
import pkg from 'pg';

const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

function toInt(v, def, { min = 1, max = 100 } = {}) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}
function toOrder(v, def = 'DESC') {
  const s = String(v || def).toUpperCase();
  return s === 'ASC' ? 'ASC' : 'DESC';
}

// Colonnes autorisées pour ORDER BY (prévention injection)
const BID_SORTS = {
  amount: 'amount_cents',       // "amount" (compat) mappe vers amount_cents
  amount_cents: 'amount_cents',
  created_at: 'created_at',
};

// GET /api/auctions/:id/bids?page=&limit=&sort=(amount|amount_cents|created_at)&order=(asc|desc)
router.get('/:id/bids', async (req, res, next) => {
  try {
    const auctionId = req.params.id;
    const page = toInt(req.query.page, 1, { min: 1, max: 100000 });
    const limit = toInt(req.query.limit, 10, { min: 1, max: 100 });
    const sortKeyReq = String(req.query.sort || 'amount').toLowerCase();
    const order = toOrder(req.query.order, 'DESC'); // défaut : montant décroissant
    const sortCol = BID_SORTS[sortKeyReq] || BID_SORTS.amount_cents;
    const offset = (page - 1) * limit;

    // Total
    const totalQ = await pool.query(
      'SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1',
      [auctionId]
    );
    const total = totalQ.rows[0]?.n ?? 0;

    // Items (on expose amount_cents + amount (euros))
    const sql = `
      SELECT
        id,
        auction_id,
        amount_cents,
        (amount_cents::numeric / 100.0) AS amount,
        created_at
      FROM bids
      WHERE auction_id = $1
      ORDER BY ${sortCol} ${order}
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await pool.query(sql, [auctionId, limit, offset]);

    const pages = Math.max(1, Math.ceil(total / limit));
    return res.json({
      total, page, pages, limit,
      sort: (sortKeyReq in BID_SORTS) ? sortKeyReq : 'amount',
      order: order.toLowerCase(),
      items: rows,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
