// backend/routes/public-auctions-router.js (ESM)
import express from "express";
import db from "../db.js";            // interop: db.js est CJS  import par défaut
const { pool } = db;

const router = express.Router();

// GET /api/public/auctions/:id/bids
// Retourne les offres (bids) pour une enchère donnée.
// Tri : montant (centimes) DESC, puis date ASC.
router.get("/api/public/auctions/:id/bids", async (req, res) => {
  const auctionId = req.params.id;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        auction_id,
        bidder,
        amount_cents,
        created_at
      FROM bids
      WHERE auction_id = $1
      ORDER BY amount_cents DESC, created_at ASC
      `,
      [auctionId]
    );

    const payload = rows.map(r => ({
      id: r.id,
      auctionId: r.auction_id,
      bidder: r.bidder,
      amountCents: Number(r.amount_cents),
      createdAt: r.created_at,
    }));

    return res.status(200).json(payload);
  } catch (err) {
    console.error("[PUBLIC BIDS] Query error:", err);
    return res.status(500).json({ error: "database_error" });
  }
});

export default router;
