// backend/db.js (ESM)
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("[DB] DATABASE_URL manquante. Exemple : postgres://user:pass@host:5432/etika");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("[DB] Erreur inattendue sur le client", err);
});

export { pool };
export default { pool };
