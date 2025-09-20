import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import pg from "pg";
const { Client } = pg;

// Charger le .env du dossier backend
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: `${__dirname}\\..\\.env` });

// Utiliser explicitement la DATABASE_URL
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

await c.query("UPDATE auctions SET sector='electricity' WHERE sector='energy';");
await c.query("UPDATE badges   SET sector='electricity' WHERE sector='energy';");

const sql =
  "SELECT 'auctions' AS \"table\", " +
  "       COUNT(*) FILTER (WHERE sector='energy') AS energy_left, " +
  "       COUNT(*) FILTER (WHERE sector='electricity') AS electricity_count " +
  "FROM auctions " +
  "UNION ALL " +
  "SELECT 'badges', " +
  "       COUNT(*) FILTER (WHERE sector='energy'), " +
  "       COUNT(*) FILTER (WHERE sector='electricity') " +
  "FROM badges;";

const r = await c.query(sql);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
