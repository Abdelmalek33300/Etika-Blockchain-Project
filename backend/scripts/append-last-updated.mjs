// backend/scripts/append-last-updated.mjs
// Ajoute/actualise le champ `last_updated` dans backend/.cache/dashboard.json
// Sans couper le serveur backend et sans toucher au reste du JSON.
//
// Utilisation :
//   (depuis C:\...\Etika-Blockchain-Project\backend)
//   node .\scripts\append-last-updated.mjs
//
// Effet : met à jour backend/.cache/dashboard.json avec un timestamp ISO dans `last_updated`.

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// On cible le dossier backend/.cache (pas la racine du repo)
const backendDir = path.resolve(__dirname, "..");           // ...\Etika-Blockchain-Project\backend
const cacheDir = path.join(backendDir, ".cache");           // ...\backend\.cache
const cacheFile = path.join(cacheDir, "dashboard.json");    // ...\backend\.cache\dashboard.json

async function writeFileAtomic(filePath, data) {
  const tmpPath = filePath + ".tmp";
  await fs.writeFile(tmpPath, data, "utf8");
  await fs.rename(tmpPath, filePath);
}

async function main() {
  try {
    await fs.access(cacheFile);

    const raw = await fs.readFile(cacheFile, "utf8");
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Le fichier ${cacheFile} n'est pas un JSON valide : ${e.message}`);
    }

    json.last_updated = new Date().toISOString();

    const pretty = JSON.stringify(json, null, 2) + "\n";
    await writeFileAtomic(cacheFile, pretty);

    console.log(`[append-last-updated] OK → ${cacheFile}`);
    console.log(`last_updated = ${json.last_updated}`);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      console.error(`[append-last-updated] Fichier introuvable : ${cacheFile}`);
      console.error("Génère d'abord le dashboard : node ..\\backend\\scripts\\build-dashboard.mjs");
      process.exit(1);
    }
    console.error("[append-last-updated] ERREUR :", err.message || err);
    process.exit(1);
  }
}

main();
