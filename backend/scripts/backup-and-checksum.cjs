#!/usr/bin/env node
/**
 * Backup + checksum des données JSON (auctions/bids).
 * - Crée backend/backup/YYYYMMDD-HHMMSS/
 * - Copie data/*.json
 * - Écrit SHA256 dans CHECKSUMS.txt
 * - Valide JSON et log un petit inventaire
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const BACKUP_DIR = path.join(ROOT, 'backup');

function ts() {
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,'0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function sha256(file) {
  return new Promise((resolve, reject)=>{
    const hash = crypto.createHash('sha256');
    const s = fs.createReadStream(file);
    s.on('error', reject);
    s.on('data', (chunk)=> hash.update(chunk));
    s.on('end', ()=> resolve(hash.digest('hex')));
  });
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

function normalizeAuctions(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.auctions)) return json.auctions;
  if (json && json.data && Array.isArray(json.data.auctions)) return json.data.auctions;
  if (json && typeof json === 'object' && (json.id || json.title)) return [json];
  return [];
}

function normalizeBids(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.bids)) return json.bids;
  // objet indexé par auctionId => { [auctionId]: Bid[] }
  if (json && typeof json === 'object') {
    const out = [];
    for (const [auctionId, arr] of Object.entries(json)) {
      if (Array.isArray(arr)) {
        for (const b of arr) out.push({ ...b, auctionId });
      }
    }
    return out;
  }
  return [];
}

async function main() {
  const stamp = ts();
  const outDir = path.join(BACKUP_DIR, stamp);
  await ensureDir(outDir);

  const files = ['auctions.json', 'bids.json'].map(f=> path.join(DATA_DIR, f));
  const present = (await Promise.all(files.map(async f=> ({ f, ok: fs.existsSync(f) })))).filter(x=>x.ok);

  if (!present.length) {
    console.log('Aucun fichier à sauvegarder dans data/.');
    return;
  }

  // Copie, checksum, inventaire
  const checksums = [];
  let inv = { auctions: 0, bids: 0 };

  for (const { f } of present) {
    const dest = path.join(outDir, path.basename(f));
    await fsp.copyFile(f, dest);

    const sum = await sha256(dest);
    checksums.push(`${sum}  ${path.basename(dest)}`);

    // inventaire
    try {
      const raw = await fsp.readFile(f, 'utf8');
      const json = JSON.parse(raw);

      if (path.basename(f) === 'auctions.json') {
        inv.auctions = normalizeAuctions(json).length;
      } else if (path.basename(f) === 'bids.json') {
        inv.bids = normalizeBids(json).length;
      }
    } catch (e) {
      console.warn(`⚠️  Fichier ${path.basename(f)} invalide JSON:`, e.message);
    }
  }

  await fsp.writeFile(path.join(outDir, 'CHECKSUMS.txt'), checksums.join('\n') + '\n', 'utf8');
  await fsp.writeFile(path.join(outDir, 'INVENTORY.txt'),
`Inventaire sauvegarde ${stamp}
- auctions: ${inv.auctions}
- bids    : ${inv.bids}

`, 'utf8');

  console.log(`✅ Backup créé: backup/${stamp}`);
  console.log(`   → CHECKSUMS.txt & INVENTORY.txt écrits.`);
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
