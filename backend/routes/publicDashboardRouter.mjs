// backend/routes/publicDashboardRouter.mjs
// Sert le dashboard public directement depuis backend/.cache/dashboard.json
// Ajoute automatiquement un champ last_updated à chaque requête.
// Désactive explicitement tout cache côté client/proxy.

import express from "express";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le cache
const cacheFile = path.resolve(__dirname, "../.cache/dashboard.json");

router.get("/api/public/dashboard", async (req, res) => {
  try {
    // En-têtes anti-cache (bonne pratique pour données volatiles)
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    // (Optionnel) res.setHeader("Surrogate-Control", "no-store");

    // Lire le fichier cache
    const raw = await fs.readFile(cacheFile, "utf8");
    const json = JSON.parse(raw);

    // Ajouter une horodatation live (UTC ISO)
    json.last_updated = new Date().toISOString();

    res.json(json);
  } catch (err) {
    console.error("[publicDashboardRouter] Erreur:", err.message || err);
    res.status(500).json({ error: "Impossible de charger le dashboard" });
  }
});

export default router;
