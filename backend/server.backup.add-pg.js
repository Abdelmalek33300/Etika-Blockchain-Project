import https from 'https';
import { pgRouter } from './routes/pg-router.mjs';
import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.js';
import auctionsRouter from './routes/auctions.js';
import bidsRouter from './routes/bids.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4433;

const app = express();
app.use("/api/pg", pgRouter);

// Sécurité (assouplie pour le dev local afin d'autoriser le script de la page)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Servir les fichiers statiques du dossier ./public
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/auth', authRouter);
app.use('/api/auctions', auctionsRouter);
app.use('/api/bids', bidsRouter);

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'dev' });
});

// HTTPS credentials
const key = fs.readFileSync(path.join(__dirname, 'certs', 'key.pem'));
const cert = fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'));

https.createServer({ key, cert }, app).listen(PORT, () => {
  console.log(`✅ HTTPS API running on https://localhost:${PORT}`);
});
