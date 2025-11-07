const express = require("express");
const router = express.Router();

// --- ROUTE PUBLIQUE : GET /api/auctions ---
router.get("/auctions", (req, res) => {
  // TODO : à remplacer plus tard par lecture JSON ou DB
  const sampleAuctions = [
    { id: 1, sector: "Banque",    candidate: "Banque A",    bid: 10000 },
    { id: 2, sector: "Assurance", candidate: "Assureur X",  bid: 8000  },
    { id: 3, sector: "Énergie",   candidate: "EDF",         bid: 12000 }
  ];
  res.json(sampleAuctions);
});

module.exports = router;
