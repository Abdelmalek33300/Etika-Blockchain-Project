import "dotenv/config";
import pg from "pg";
const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "etika",
  user: process.env.PGUSER || "etika",
  password: process.env.PGPASSWORD || "etika",
});
(async () => {
  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    await pool.query("ALTER TABLE auctions ALTER COLUMN id SET DEFAULT gen_random_uuid();");
    await pool.query("ALTER TABLE auctions ALTER COLUMN starts_at DROP NOT NULL;");
    await pool.query("ALTER TABLE auctions ALTER COLUMN ends_at DROP NOT NULL;");
    console.log("SCHEMA_FIXED");
  } catch (e) {
    console.error("ERR:", e.message);
  } finally {
    await pool.end();
  }
})();
