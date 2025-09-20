import fs from "node:fs";
import jwt from "jsonwebtoken";

let env = "";
try { env = fs.readFileSync(".env", "utf8"); } catch {}
env = env.replace(/^\uFEFF/, "");

// Cherche JWT_SECRET dans .env puis dans l'env
let secret = null;
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*JWT_SECRET\s*=\s*(.+)\s*$/);
  if (m) { secret = m[1].trim(); break; }
}
if (!secret && process.env.JWT_SECRET) secret = String(process.env.JWT_SECRET);
if (!secret) { console.error("JWT_SECRET missing"); process.exit(1); }
if ((secret.startsWith('"') && secret.endsWith('"')) || (secret.startsWith("'") && secret.endsWith("'"))) {
  secret = secret.slice(1, -1);
}

// Payload admin
const payload = { sub: "22222222-2222-2222-2222-222222222222", role: "admin", name: "admin" };

// TTL: --ttl=30d ou var d'env ADMIN_TOKEN_TTL, défaut 2h
let ttl = "2h";
for (const a of process.argv.slice(2)) {
  if (a.startsWith("--ttl=")) ttl = a.slice(6).trim();
}
if (process.env.ADMIN_TOKEN_TTL) ttl = process.env.ADMIN_TOKEN_TTL;

// Génère et affiche le token
const token = jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: ttl });
process.stdout.write(token);