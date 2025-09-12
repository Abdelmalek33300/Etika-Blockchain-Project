// scripts/migrate-to-postgres.mjs
// Migration JSON -> PostgreSQL (idempotente). Projet en ESM.

import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
const { Client } = pg;

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT, 'data');
const CONN = process.env.PG_CONN || 'postgres://etika:etika@localhost:5432/etika?sslmode=disable';

// -- Helpers ----------------------------------------------------
function isObj(x){ return x && typeof x === 'object' && !Array.isArray(x); }
function toArrayAuctions(json){
  if (Array.isArray(json)) return json;
  if (isObj(json) && Array.isArray(json.auctions)) return json.auctions;
  if (isObj(json) && isObj(json.data) && Array.isArray(json.data.auctions)) return json.data.auctions;
  if (isObj(json) && (json.id || json.title)) return [json];
  return [];
}
function toArrayBids(json){
  if (Array.isArray(json)) return json;
  if (isObj(json) && Array.isArray(json.bids)) return json.bids;
  if (isObj(json)) { // { [auctionId]: Bid[] }
    const out = [];
    for (const [auctionId, arr] of Object.entries(json)) {
      if (Array.isArray(arr)) for (const b of arr) out.push({ ...b, auctionId });
    }
    return out;
  }
  return [];
}
function cents(x){
  if (x == null) return null;
  const n = Number(x);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}
async function readJsonSafe(file, fallback=[]){
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch { return fallback; }
}

// -- Main -------------------------------------------------------
async function main(){
  const client = new Client({ connectionString: CONN });
  await client.connect();

  // DDL: crée tables si absentes
  await client.query(`
    CREATE TABLE IF NOT EXISTS auctions (
      id          UUID PRIMARY KEY,
      title       TEXT NOT NULL,
      sector      TEXT NOT NULL,
      description TEXT DEFAULT '',
      starts_at   TIMESTAMPTZ NOT NULL,
      ends_at     TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS auctions_starts_idx ON auctions (starts_at);`);
  await client.query(`CREATE INDEX IF NOT EXISTS auctions_ends_idx   ON auctions (ends_at);`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id           UUID PRIMARY KEY,
      auction_id   UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
      bidder       TEXT NOT NULL,
      amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS bids_best_idx ON bids (auction_id, amount_cents DESC, created_at DESC);`);

  // Lire JSON
  const auctionsRaw = await readJsonSafe(path.join(DATA_DIR, 'auctions.json'), []);
  const bidsRaw     = await readJsonSafe(path.join(DATA_DIR, 'bids.json'), []);
  const auctions = toArrayAuctions(auctionsRaw);
  const bids     = toArrayBids(bidsRaw);

  // Import auctions (idempotent)
  let aOK=0, aSkip=0;
  for (const a of auctions){
    const id = a.id || a.auctionId;
    const title = (a.title || a.name || '').toString().trim();
    const sector = (a.sector || '').toString().trim() || 'N/A';
    const description = (a.description || '').toString();
    const startsAt = a.startsAt || a.startAt || a.starts_at || a.start_date;
    const endsAt   = a.endsAt   || a.endAt   || a.ends_at   || a.end_date;
    const createdAt = a.createdAt || a.created_at || null;

    if (!id || !title || !startsAt || !endsAt) { aSkip++; continue; }

    await client.query(
      `INSERT INTO auctions (id, title, sector, description, starts_at, ends_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, now()))
       ON CONFLICT (id) DO NOTHING;`,
      [id, title, sector, description, startsAt, endsAt, createdAt]
    );
    aOK++;
  }

  // Import bids (idempotent)
  let bOK=0, bSkip=0;
  for (const b of bids){
    const id = b.id || b.bidId;
    const auctionId = b.auctionId || b.auction_id;
    const bidder = (b.bidder || b.company || '').toString().trim();
    const amountCents = b.amount_cents != null ? Number(b.amount_cents) : cents(b.amount);
    const createdAt = b.createdAt || b.created_at || null;

    if (!id || !auctionId || !bidder || !amountCents || amountCents<=0) { bSkip++; continue; }

    await client.query(
      `INSERT INTO bids (id, auction_id, bidder, amount_cents, created_at)
       VALUES ($1,$2,$3,$4, COALESCE($5, now()))
       ON CONFLICT (id) DO NOTHING;`,
      [id, auctionId, bidder, amountCents, createdAt]
    );
    bOK++;
  }

  console.log(`✅ Migration OK`);
  console.log(`   Auctions: inserted=${aOK}, skipped=${aSkip}, total_json=${auctions.length}`);
  console.log(`   Bids    : inserted=${bOK}, skipped=${bSkip}, total_json=${bids.length}`);

  await client.end();
}

main().catch((e)=>{ console.error('❌ Migration failed:', e); process.exit(1); });
