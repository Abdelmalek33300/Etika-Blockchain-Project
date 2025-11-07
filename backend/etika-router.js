import { Router } from "express";

const router = Router();

// --- ROUTE PUBLIQUE : GET /api/auctions ---
router.get("/auctions", (req, res) => {
  const sampleAuctions = [
    { id: 1, sector: "Banque",    candidate: "Banque A",    bid: 10000 },
    { id: 2, sector: "Assurance", candidate: "Assureur X",  bid: 8000  },
    { id: 3, sector: "Énergie",   candidate: "EDF",         bid: 12000 }
  ];
  res.json(sampleAuctions);
});

export default router;
