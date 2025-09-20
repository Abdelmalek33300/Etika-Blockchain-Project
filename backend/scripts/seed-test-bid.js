// backend/scripts/seed-test-bid.js  ESM, aligné schéma (id, auction_id uuid, bidder text, amount_cents bigint)
import pg from "pg";
import { randomUUID } from "node:crypto";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL manquante. Exemple: postgres://user:pass@localhost:5432/etika");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
  max: 1,
  connectionTimeoutMillis: 10000,
});

async function main() {
  const auctionId = process.argv[2];
  const amountCents = Number(process.argv[3] ?? 1234);
  const bidder = process.argv.slice(4).join(" ") || "Demo Corp";

  const uuidRegex = /^[0-9a-fA-F-]{36}$/;
  if (!auctionId || !uuidRegex.test(auctionId)) {
    console.error("Paramètre invalide: auctionId (UUID requis). Utilisation: node backend/scripts/seed-test-bid.js <AUCTION_UUID> <AMOUNT_CENTS> \"Bidder Name\"");
    process.exit(1);
  }
  if (!Number.isFinite(amountCents)) {
    console.error("Paramètre invalide: amountCents (nombre en centimes).");
    process.exit(1);
  }

  try {
    const id = randomUUID();
    const { rows } = await pool.query(
      `INSERT INTO bids (id, auction_id, bidder, amount_cents)
       VALUES ($1, $2, $3, $4)
       RETURNING id, auction_id, bidder, amount_cents, created_at`,
      [id, auctionId, bidder, amountCents]
    );
    console.log("OK insert:", rows[0]);
  } catch (err) {
    console.error("Erreur INSERT:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
