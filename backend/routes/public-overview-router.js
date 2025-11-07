// backend/routes/public-overview-router.js
// GET /api/public/overview — Compatible Aperçu (champ `seuil`) + Enchères (sectors, percent, breakdown)

import express from "express";
const router = express.Router();

// Utils
function toInt(val, def) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : def;
}
function computePercent(total, threshold) {
  if (threshold <= 0) return 0;
  const p = (total / threshold) * 100;
  return Math.max(0, Math.min(100, p));
}

// Config (mock)
const LAUNCH_THRESHOLD = toInt(process.env.LAUNCH_THRESHOLD, 100000);
const MOCK_PARTICIPANTS_TOTAL = toInt(process.env.MOCK_PARTICIPANTS_TOTAL, 50000);

const MOCK_BREAKDOWN = {
  consumers: 42000,
  businesses: 5000,
  sponsor_candidates: 2000,
  crypto_investors: 1000,
};

const SECTORS = [
  { id: "energie",    title: "Énergie",            status: "open", offers_count: 12, best_offer_eur: 22250 },
  { id: "banque",     title: "Banque",             status: "open", offers_count:  9, best_offer_eur: 19800 },
  { id: "telephonie", title: "Téléphonie",         status: "open", offers_count:  7, best_offer_eur: 17500 },
  { id: "assurance",  title: "Assurance",          status: "open", offers_count:  6, best_offer_eur: 13400 },
  { id: "telecoms",   title: "Télécoms",           status: "open", offers_count:  5, best_offer_eur: 12100 },
  { id: "vod",        title: "Vidéo à la demande", status: "open", offers_count:  4, best_offer_eur:  8800 },
];

// Route
router.get("/api/public/overview", (req, res) => {
  const participants_total = MOCK_PARTICIPANTS_TOTAL;
  const percent = computePercent(participants_total, LAUNCH_THRESHOLD);

  // Champs legacy attendus par la page "Aperçu"
  const legacy = {
    participants: MOCK_BREAKDOWN.consumers,
    entreprises: MOCK_BREAKDOWN.businesses,
    sponsors: MOCK_BREAKDOWN.sponsor_candidates,
    investisseurs: MOCK_BREAKDOWN.crypto_investors,
    seuil: {
      percent,              // <-- pour json.seuil.percent
      global: LAUNCH_THRESHOLD
    }
  };

  res.json({
    // Nouvelle forme (pour Enchères)
    threshold: LAUNCH_THRESHOLD,
    participants_total,
    percent,
    sectors: SECTORS,
    breakdown: MOCK_BREAKDOWN,
    // Compatibilité Aperçu
    ...legacy
  });
});

export default router;
