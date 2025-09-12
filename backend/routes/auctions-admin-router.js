import express from 'express';
import { pool } from '../services/db.js';
import { verifyJWT, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// POST /api/admin/auctions  (ADMIN)
router.post('/', verifyJWT, requireAdmin, async (req, res) => {
  try {
    const { title, sector } = req.body || {};
    if (!title || !sector) return res.status(400).json({ error: 'title and sector are required' });

    const { rows } = await pool.query(
      `INSERT INTO auctions (title, sector)
       VALUES ($1,$2)
       RETURNING id, title, sector, created_at`,
      [title, sector]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /api/admin/auctions error:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

// DELETE /api/admin/auctions/:id  (ADMIN) — bloqué si bids existent
router.delete('/:id', verifyJWT, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: cnt } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM bids WHERE auction_id=$1',
      [id]
    );
    if (cnt[0].n > 0) {
      return res.status(409).json({ error: 'Auction has bids; deletion is blocked.' });
    }

    const { rowCount } = await pool.query('DELETE FROM auctions WHERE id=$1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Auction not found' });

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/auctions/:id error:', err);
    res.status(500).json({ error: 'DB error' });
  }
});

export default router;
