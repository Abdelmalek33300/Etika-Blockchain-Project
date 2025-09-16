import fs from "fs";
import pg from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/run-sql-file.mjs <path-to-sql>");
  process.exit(1);
}
const sql = fs.readFileSync(file, "utf8");

const { Pool } = pg;

// Priorité à DATABASE_URL si présent, sinon PG* variables locales
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "etika",
      user: process.env.PGUSER || "etika",
      password: process.env.PGPASSWORD || "etika",
      ssl: false,
    });

(async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("OK: executed", file);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("ERROR running", file, "=>", e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
