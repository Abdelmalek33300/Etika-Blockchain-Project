// backend/routes/public-bids-router.js (ESM)
// Endpoint public: GET /api/public/auctions/:id/bids
// Renvoie le classement des offres (compétiteurs) pour une enchère/secteur donné.

import express from "express";
const router = express.Router();

/**
 * Mock de données par secteur (id = "energie", "banque", etc.)
 * amount_cents: entier en centimes (tri décroissant)
 * offeror: nom court (fictif)
 * created_at: ISO string
 */
const MOCK_BIDS_BY_SECTOR = {
  energie: [
    { offeror: "EDF",        amount_cents: 2225000, created_at: "2026-01-05T10:10:00Z" },
    { offeror: "TotalEnergies", amount_cents: 2190000, created_at: "2026-01-05T09:55:00Z" },
    { offeror: "Engie",      amount_cents: 2145000, created_at: "2026-01-04T16:30:00Z" },
    { offeror: "Eni",        amount_cents: 2050000, created_at: "2026-01-03T12:20:00Z" },
  ],
  banque: [
    { offeror: "BNP Paribas",  amount_cents: 1980000, created_at: "2026-01-04T09:00:00Z" },
    { offeror: "Société Générale", amount_cents: 1920000, created_at: "2026-01-03T18:10:00Z" },
    { offeror: "Crédit Agricole",  amount_cents: 1890000, created_at: "2026-01-03T11:35:00Z" },
  ],
  telephonie: [
    { offeror: "Orange",   amount_cents: 1750000, created_at: "2026-01-05T08:45:00Z" },
    { offeror: "SFR",      amount_cents: 1680000, created_at: "2026-01-04T20:10:00Z" },
    { offeror: "Bouygues", amount_cents: 1620000, created_at: "2026-01-04T13:25:00Z" },
    { offeror: "Free",     amount_cents: 1600000, created_at: "2026-01-04T09:05:00Z" },
  ],
  assurance: [
    { offeror: "Axa",        amount_cents: 1340000, created_at: "2026-01-02T17:00:00Z" },
    { offeror: "Allianz",    amount_cents: 1280000, created_at: "2026-01-02T12:10:00Z" },
    { offeror: "MAIF",       amount_cents: 1210000, created_at: "2026-01-01T16:42:00Z" },
  ],
  telecoms: [
    { offeror: "OVHcloud",   amount_cents: 1210000, created_at: "2026-01-03T10:15:00Z" },
    { offeror: "Iliad",      amount_cents: 1180000, created_at: "2026-01-02T14:22:00Z" },
  ],
  vod: [
    { offeror: "Netflix",    amount_cents:  880000, created_at: "2026-01-02T09:40:00Z" },
    { offeror: "Amazon Prime", amount_cents: 830000, created_at: "2026-01-01T22:05:00Z" },
    { offeror: "Canal+",     amount_cents:  790000, created_at: "2026-01-01T18:30:00Z" },
  ],
};

/** Utilitaires */
function asInt(val, def) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : def;
}

/**
 * GET /api/public/auctions/:id/bids?page=&limit=
 * Réponse:
 * {
 *   auction_id: "energie",
 *   total: 4,
 *   page: 1,
 *   limit: 20,
 *   bids: [{ rank:1, offeror:"...", amount_cents:2225000, amount_eur:22250, created_at:"..." }, ...]
 * }
 */
router.get("/api/public/auctions/:id/bids", (req, res) => {
  const { id } = req.params;
  const page = Math.max(1, asInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(1, asInt(req.query.limit, 20)));

  const raw = Array.isArray(MOCK_BIDS_BY_SECTOR[id]) ? [...MOCK_BIDS_BY_SECTOR[id]] : [];

  // Tri décroissant par montant
  raw.sort((a, b) => b.amount_cents - a.amount_cents);

  const total = raw.length;
  const start = (page - 1) * limit;
  const slice = raw.slice(start, start + limit);

  const bids = slice.map((b, i) => ({
    rank: start + i + 1,
    offeror: b.offeror,
    amount_cents: b.amount_cents,
    amount_eur: Math.round(b.amount_cents) / 100,
    created_at: b.created_at,
  }));

  res.json({
    auction_id: id,
    total,
    page,
    limit,
    bids,
  });
});

export default router;
