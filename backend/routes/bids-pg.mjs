import { Router } from 'express';
import { pool } from '../db.mjs';

const router = Router();

/**
 * GET /api/bids/:auctionId
 * Renvoie les bids d'une enchère, avec amount calculé depuis amount_cents/100.0
 */
router.get('/:auctionId', async (req, res) => {
  const { auctionId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, auction_id,
              bidder,
              CASE WHEN amount_cents IS NOT NULL THEN amount_cents/100.0 ELSE NULL END AS amount,
              created_at
       FROM bids
       WHERE auction_id = $1
       ORDER BY created_at DESC NULLS LAST, id
       LIMIT 500`,
      [auctionId]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/bids/:auctionId (pg) failed:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

/**
 * GET /api/bids?auctionId=...
 * Variante par querystring pour compat éventuelle
 */
router.get('/', async (req, res) => {
  const { auctionId } = req.query;
  if (!auctionId) return res.json([]);
  try {
    const { rows } = await pool.query(
      `SELECT id, auction_id,
              bidder,
              CASE WHEN amount_cents IS NOT NULL THEN amount_cents/100.0 ELSE NULL END AS amount,
              created_at
       FROM bids
       WHERE auction_id = $1
       ORDER BY created_at DESC NULLS LAST, id
       LIMIT 500`,
      [auctionId]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/bids?auctionId (pg) failed:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
