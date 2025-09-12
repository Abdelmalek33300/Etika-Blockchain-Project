import express from "express";
import { pool } from "../services/db.js";

const router = express.Router();

// GET /api/auctions/:id/bids   renvoie les bids de l'enchère (même format que /api/bids/:auctionId)
router.get("/:id/bids", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, auction_id, bidder,
              (amount_cents/100.0)::numeric AS amount,
              created_at
         FROM bids
        WHERE auction_id = $1
        ORDER BY created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET /api/auctions/:id/bids error:", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
