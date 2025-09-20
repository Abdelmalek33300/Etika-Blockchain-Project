console.log("[PG-ROUTER] v2 loaded (amount_cents)");
import { Router } from 'express';
import { pool } from '../db.mjs';

export const pgRouter = Router();

// Liste des enchères avec nb de bids
pgRouter.get('/auctions', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.title, a.sector, a.created_at,
             COUNT(b.id)::int AS bids_count
      FROM auctions a
      LEFT JOIN bids b ON b.auction_id = a.id
      GROUP BY a.id, a.title, a.sector, a.created_at
      ORDER BY a.created_at DESC NULLS LAST, a.id
      LIMIT 100
    `);
    res.json(rows);
  } catch (e) {
    console.error('GET /api/pg/auctions failed:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Bids d'une enchère (amount en décimal depuis amount_cents)
pgRouter.get('/bids/:auctionId', async (req, res) => {
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
    console.error('GET /api/pg/bids/:auctionId failed:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});
