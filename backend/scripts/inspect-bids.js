// backend/scripts/inspect-bids.js (ESM)
import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  max: 1,
  connectionTimeoutMillis: 10000,
});

const table = process.argv[2] ?? "bids";

try {
  const { rows } = await pool.query(
    `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = current_schema() and table_name = $1
     order by ordinal_position`,
    [table]
  );
  console.log(JSON.stringify(rows, null, 2));
} catch (err) {
  console.error("Erreur inspect:", err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
