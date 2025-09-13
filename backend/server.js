// server.js — ESM, HTTPS, CORS, Helmet, rate-limit, PG router par défaut
import express from 'express';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// 🔐 Routes (CJS acceptées via default import)
import authRouter from './routes/auth.js';
import adminAuctionsRouter from './routes/auctions-admin-router.js';
import aliasBidsRouter from './routes/auctions-bids-alias.js';

// ✅ Router PostgreSQL (export défaut)
import pgRouter from './routes/pg-router.mjs';

// (Optionnel si tu gardes les routes JSON de secours)
// import auctionsRouter from './routes/auctions.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ———————————————————————————————————————————————
// Sécurité & middlewares
// ———————————————————————————————————————————————
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '1mb' }));

// Helmet : prod strict, dev assoupli
if (isProd) {
  app.use(helmet());
} else {
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: false,
    }),
  );
}

// CORS whitelist depuis .env (ALLOWED_ORIGINS=origin1,origin2)
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // outils locaux
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Rate-limit spécifique au login
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

// ———————————————————————————————————————————————
// Health
// ———————————————————————————————————————————————
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: isProd ? 'production' : 'development' });
});

// ———————————————————————————————————————————————
/**
 * Routes
 * - /api/auth           -> authRouter
 * - /api/admin/auctions -> adminAuctionsRouter
 * - /api                 -> pgRouter (auctions + bids via PostgreSQL)
 * - /api/auctions/:id/bids -> alias vers /api/bids/:auctionId
 */
// ———————————————————————————————————————————————
app.use('/api/auth', authRouter);
app.use('/api/admin/auctions', adminAuctionsRouter);

// PostgreSQL router (auctions & bids)
console.log('[BOOT] Using PostgreSQL for /api/auctions & /api/bids');
app.use('/api', pgRouter);

// Alias public: /api/auctions/:id/bids  -> renvoie les bids d’une enchère
app.use('/api/auctions', aliasBidsRouter);

// (Optionnel) Fallback JSON si tu veux garder l’ancien routeur hors-PG
// app.use('/api/auctions', auctionsRouter);

// ———————————————————————————————————————————————
// HTTPS server
// ———————————————————————————————————————————————
const PORT = Number(process.env.PORT_HTTPS || 4443);

// Recherche des certificats (plusieurs chemins possibles)
function readFirstKeyPair() {
  const candidates = [
    { key: process.env.SSL_KEY_FILE, cert: process.env.SSL_CERT_FILE },
    { key: path.join(__dirname, 'localhost-key.pem'), cert: path.join(__dirname, 'localhost-cert.pem') },
    { key: path.join(__dirname, 'certs', 'server.key'), cert: path.join(__dirname, 'certs', 'server.crt') },
    { key: path.join(__dirname, 'certs', 'key.pem'), cert: path.join(__dirname, 'certs', 'cert.pem') },
  ].filter(p => p.key && p.cert);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p.key) && fs.existsSync(p.cert)) {
        return { key: fs.readFileSync(p.key), cert: fs.readFileSync(p.cert) };
      }
    } catch {}
  }
  throw new Error('TLS key/cert introuvables. Configure SSL_KEY_FILE / SSL_CERT_FILE ou place tes certs dans ./certs/');
}

const tls = readFirstKeyPair();

const server = https.createServer(tls, app);

server.listen(PORT, () => {
  console.log(`✅ HTTPS API running on https://localhost:${PORT}`);
});

// Gestion propre des erreurs d’écoute
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} déjà utilisé.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
