import { Router } from 'express';
import { pool } from '../db.mjs';
export default Router()
  .get('/', async (_req, res) => {
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
      console.error('GET /api/auctions (pg) failed:', e);
      res.status(500).json({ error: 'internal_error' });
    }
  });
