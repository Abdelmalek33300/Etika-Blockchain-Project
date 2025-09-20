// routes/bids.js
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// --- règle: pas minimum au-dessus du meilleur bid (en euros)
const MIN_INCREMENT_EUR = 100;

async function loadJson(file, fallback) {
  try {
    const p = path.join(DATA_DIR, file);
    const txt = await fs.readFile(p, 'utf8');
    return JSON.parse(txt);
  } catch {
    return fallback;
  }
}
async function saveJson(file, data) {
  const p = path.join(DATA_DIR, file);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2));
}

// Supporter ancien format (tableau) et format courant (objet { auctionId: [] })
function normalizeStore(data) {
  if (Array.isArray(data)) {
    const map = {};
    for (const b of data) {
      if (!b || !b.auctionId) continue;
      (map[b.auctionId] = map[b.auctionId] || []).push(b);
    }
    return map;
  }
  return (data && typeof data === 'object') ? data : {};
}

const router = Router();

/**
 * GET /api/bids/:auctionId
 * Retour: { auctionId, count, bids[] }
 */
router.get('/:auctionId', async (req, res) => {
  const { auctionId } = req.params;
  const store = normalizeStore(await loadJson('bids.json', {}));
  const list = store[auctionId] || [];
  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return res.json({ auctionId, count: list.length, bids: list });
});

/**
 * POST /api/bids
 * Body: { auctionId, amount, bidder }
 * - Vérifie que l’enchère existe
 * - Refuse si amount <= meilleur bid
 * - Refuse si amount < (meilleur bid + MIN_INCREMENT_EUR) quand un meilleur existe
 * - Enregistre sinon
 */
router.post('/', async (req, res) => {
  try {
    const { auctionId, amount, bidder } = req.body || {};

    // Validations simples
    if (!auctionId) return res.status(400).json({ error: 'auctionId requis' });
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return res.status(400).json({ error: 'amount doit être un nombre > 0' });
    }
    const name = String(bidder || '').trim();
    if (!name) return res.status(400).json({ error: 'bidder requis' });

    // L’enchère doit exister
    const auctions = await loadJson('auctions.json', []);
    const auction = auctions.find(a => a.id === auctionId);
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    // Charger les bids et calculer le meilleur
    const store = normalizeStore(await loadJson('bids.json', {}));
    const current = store[auctionId] || [];
    const highest = current.reduce((m, b) => {
      const v = Number(b?.amount);
      return Number.isFinite(v) && v > m ? v : m;
    }, 0);

    // Règles de comparaison
    if (highest > 0) {
      const required = highest + MIN_INCREMENT_EUR;
      if (num < required) {
        return res.status(400).json({
          error: `Bid must be at least ${MIN_INCREMENT_EUR} above current highest bid (${highest})`,
          highest,
          required,
          minIncrement: MIN_INCREMENT_EUR
        });
      }
    } else {
      // premier bid: juste > 0, on a déjà vérifié
    }

    // Créer et sauvegarder le bid
    const bid = {
      auctionId,
      id: crypto.randomUUID(),
      amount: num,
      bidder: name,
      createdAt: new Date().toISOString()
    };

    store[auctionId] = [...current, bid];
    await saveJson('bids.json', store);

    return res.status(201).json(bid);
  } catch (e) {
    console.error('POST /bids error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
