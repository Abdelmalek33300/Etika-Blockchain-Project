// backend/serve-learn.js (ESM)
// Mini-serveur statique dédié aux pages "learn", séparé de l'API existante.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Sert le dossier public (pour assets éventuels)
app.use(express.static(path.join(__dirname, "public")));

// Route explicite vers "Comment ça marche"
app.get("/learn/how-it-works/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "learn", "how-it-works", "index.html"));
});

const PORT = 4100;
app.listen(PORT, () => {
  console.log(`[LEARN] pages servies sur http://localhost:${PORT}/learn/how-it-works/`);
});
