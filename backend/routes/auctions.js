import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireAdmin } from '../services/jwt.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const AUCTIONS_FILE = path.join(DATA_DIR, 'auctions.json');

function readAuctions() {
  try {
    const raw = fs.readFileSync(AUCTIONS_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAuctions(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AUCTIONS_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// GET /api/auctions — liste
router.get('/', (req, res) => {
  const items = readAuctions();
  res.json({ items, total: items.length });
});

// POST /api/auctions — créer (admin)
router.post('/', requireAuth, requireAdmin, (req, res) => {
  const { sector, title, description, startsAt, endsAt } = req.body || {};
  if (!sector || !title || !startsAt || !endsAt) {
    return res.status(400).json({ error: 'Missing required fields: sector, title, startsAt, endsAt' });
  }
  const items = readAuctions();
  const created = {
    id: uuidv4(),
    sector,
    title,
    description: description || '',
    startsAt,
    endsAt,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  items.push(created);
  writeAuctions(items);
  res.status(201).json(created);
});

export default router;
