// routes/auctions.js (ESM)
import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { query, validationResult } from 'express-validator';
import pagination from '../utils/pagination.js'; // CJS interop
const { paginateAndSort } = pagination;

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ——— Fallback JSON ———
async function loadJson(relative) {
  try {
    const full = path.join(__dirname, '..', relative);
    const raw = await readFile(full, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// ——— Service optionnel (si présent) ———
async function listAuctionsPublic() {
  try {
    const mod = await import('../services/auctions-service.js');
    const svc = mod.default || mod;
    if (svc?.listPublic) return await svc.listPublic();
  } catch {}
  return loadJson('data/auctions.json');
}

// ——— Validators ———
const listAuctionsValidators = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('sort').optional().isIn(['createdAt', 'endsAt', 'title', 'sector']),
  query('order').optional().isIn(['asc', 'desc']),
];

// ——— Helper ———
function ensureValid(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array().map(e => ({ field: e.param, msg: e.msg })) });
  }
  return null;
}

// ——— Route publique ———
// GET /api/auctions — pagination + tri (défaut: date de fin croissante)
router.get('/', listAuctionsValidators, async (req, res, next) => {
  try {
    const invalid = ensureValid(req, res);
    if (invalid) return;

    const { page = 1, limit = 10, sort, order = 'asc' } = req.query;
    const auctions = await listAuctionsPublic();

    const sortKey = sort || 'endsAt';
    const sortType =
      sortKey === 'createdAt' || sortKey === 'endsAt' ? 'date' :
      sortKey === 'title' || sortKey === 'sector' ? 'string' : 'string';

    const { meta, items } = paginateAndSort(auctions, {
      page, limit, sort: sortKey, order, sortType, maxLimit: 100,
    });

    return res.json({ ...meta, items });
  } catch (err) {
    next(err);
  }
});

export default router;
