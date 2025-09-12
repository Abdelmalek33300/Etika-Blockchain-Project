import https from 'https';
import { pgRouter } from './routes/pg-router.mjs';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import auctionsRouter from './routes/auctions.js';
import bidsRouter from './routes/bids.js';
import auctionsPg from './routes/auctions-pg.mjs';
import bidsPg from './routes/bids-pg.mjs';
import auctionsBidsAlias from './routes/auctions-bids-alias.js';
import auctionsAdminRouter from './routes/auctions-admin-router.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4433;

const app = express();
app.use("/api/pg", pgRouter);

// SÃ©curitÃ© (assouplie pour le dev local afin d'autoriser le script de la page)
if (process.env.NODE_ENV === 'production') {
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: true,
    referrerPolicy: { policy: "no-referrer" },
    hsts: { maxAge: 15552000, includeSubDomains: true, preload: true }
  }));
} else {
  // Dev local : CSP désactivée pour ne rien casser
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
}const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl/node
    if (allowed.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/login', loginLimiter);
app.use('/api/auctions', auctionsBidsAlias);
app.use('/api/admin/auctions', auctionsAdminRouter);

// Servir les fichiers statiques du dossier ./public
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/auth', authRouter);
if (process.env.USE_PG === '1') {
  console.log('[BOOT] Using PostgreSQL for /api/auctions & /api/bids');
  app.use('/api/auctions', auctionsPg);
  app.use('/api/bids', bidsPg);
} else {
  app.use('/api/auctions', auctionsRouter);
  app.use('/api/bids', bidsRouter);
}
app.use('/api/auctions-pg', auctionsPg);
app.use('/api/bids-pg', bidsPg);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'dev' });
});

// HTTPS credentials
const key = fs.readFileSync(path.join(__dirname, 'certs', 'key.pem'));
const cert = fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'));

https.createServer({ key, cert }, app).listen(PORT, () => {
  console.log(`âœ… HTTPS API running on https://localhost:${PORT}`);
});






