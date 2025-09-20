import express from "express";

import auctionsPg from "./auctions-pg.mjs";
import auctionsBidsAlias from "./auctions-bids-alias.js";
import auctionsAdminRouter from "./auctions-admin-router.js";

const router = express.Router();

/**
 * Public (PG):
 *  - /api/auctions
 *  - /api/auctions/:id/bids (alias)
 *
 * NOTE: /api/public/counters est géré par routes/public-counters-router.mjs
 *       et monté dans server.js AVANT ce routeur.
 */
router.use("/auctions", auctionsPg);
router.use("/auctions", auctionsBidsAlias);

// Admin
router.use("/admin/auctions", auctionsAdminRouter);

export default router;