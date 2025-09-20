// backend/scripts/inspect-auctions.js (ESM)
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  max: 1,
  connectionTimeoutMillis: 10000,
});

try {
  const { rows } = await pool.query("select * from auctions order by created_at desc limit 10");
  // Affiche juste id + colonnes connues si présentes
  const mapped = rows.map(r => ({
    id: r.id ?? null,
    sector: r.sector ?? r.category ?? null,
    title: r.title ?? r.name ?? null,
    created_at: r.created_at ?? null
  }));
  console.log(JSON.stringify(mapped, null, 2));
} catch (err) {
  console.error("Erreur inspect auctions:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
