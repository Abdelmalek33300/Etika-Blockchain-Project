// backend/server.js (version unifiée PFX/PEM + compat .env)
// ESM
import "dotenv/config";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname } from "path";

// ---------------- Path helpers ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const rel = (...p) => path.join(__dirname, ...p);

// ---------------- Env helpers (compat) ----------------
// Ports (accepte HTTPS_PORT ou PORT_HTTPS ; HTTP_PORT ou PORT_HTTP)
const HTTPS_PORT = Number(
  process.env.HTTPS_PORT ??
  process.env.PORT_HTTPS ??
  4443
);
const HTTP_PORT = Number(
  process.env.HTTP_PORT ??
  process.env.PORT_HTTP ??
  4000
);

// PFX (accepte TLS_PFX_PATH/PFX_PATH + TLS_PFX_PASSPHRASE/PFX_PASSPHRASE)
const PFX_PATH = process.env.TLS_PFX_PATH ?? process.env.PFX_PATH ?? rel("certs", "localhost.pfx");
const PFX_PASSPHRASE = process.env.TLS_PFX_PASSPHRASE ?? process.env.PFX_PASSPHRASE ?? "";

// PEM (accepte TLS_CERT_PATH/CERT_PATH + TLS_KEY_PATH/KEY_PATH)
const CERT_PATH = process.env.TLS_CERT_PATH ?? process.env.CERT_PATH ?? rel("certs", "localhost.pem");
const KEY_PATH  = process.env.TLS_KEY_PATH  ?? process.env.KEY_PATH  ?? rel("certs", "localhost-key.pem");

// CORS (liste CSV ou “*”)
const RAW_ORIGINS = process.env.ALLOWED_ORIGINS ?? "*";
const ORIGINS = RAW_ORIGINS === "*"
  ? true
  : RAW_ORIGINS.split(",").map(s => s.trim()).filter(Boolean);

// ---------------- App ----------------
const app = express();
app.use(cors({ origin: ORIGINS, credentials: true }));
app.use(express.json({ limit: "1mb" }));

// Healthcheck
app.get("/healthz", (_req, res) => res.json({ ok: true }));

// Routes Étika
import etikaRouter from "./etika-router.js";
app.use("/api", etikaRouter);

// ---------------- HTTPS helpers ----------------
function existsNonEmpty(p) {
  try {
    const st = fs.statSync(p);
    return st.isFile() && st.size > 0;
  } catch { return false; }
}

function startHttpsWithPfx() {
  if (!existsNonEmpty(PFX_PATH)) {
    console.warn(`[HTTPS:PFX] Fichier introuvable ou vide: ${PFX_PATH}`);
    return null;
  }
  try {
    const pfx = fs.readFileSync(PFX_PATH);
    const httpsServer = https.createServer(
      { pfx, passphrase: PFX_PASSPHRASE, requestCert: false, rejectUnauthorized: false },
      app
    );
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`HTTPS (PFX) prêt : https://localhost:${HTTPS_PORT}`);
      console.log(`PFX utilisé : ${PFX_PATH}`);
    });
    return httpsServer;
  } catch (err) {
    console.error("[HTTPS:PFX] Échec :", err?.message || err);
    return null;
  }
}

function startHttpsWithPem() {
  if (!existsNonEmpty(CERT_PATH) || !existsNonEmpty(KEY_PATH)) {
    console.warn(`[HTTPS:PEM] CERT/KEY introuvables ou vides: cert=${CERT_PATH} key=${KEY_PATH}`);
    return null;
  }
  try {
    const key  = fs.readFileSync(KEY_PATH);
    const cert = fs.readFileSync(CERT_PATH);
    const httpsServer = https.createServer(
      { key, cert, requestCert: false, rejectUnauthorized: false },
      app
    );
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`HTTPS (PEM) prêt : https://localhost:${HTTPS_PORT}`);
      console.log(`CERT utilisé : ${CERT_PATH}`);
      console.log(`KEY  utilisé : ${KEY_PATH}`);
    });
    return httpsServer;
  } catch (err) {
    console.error("[HTTPS:PEM] Échec :", err?.message || err);
    return null;
  }
}

function startHttp() {
  const httpServer = http.createServer(app);
  httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP dev (fallback) : http://localhost:${HTTP_PORT}`);
  });
  return httpServer;
}

// ---------------- Boot sequence ----------------
let httpsServer = startHttpsWithPfx();
if (!httpsServer) {
  httpsServer = startHttpsWithPem();
}
const httpServer = startHttp(); // on garde l’HTTP dev actif en parallèle pour le debug

// ---------------- Robustesse ----------------
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
