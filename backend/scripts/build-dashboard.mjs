import "dotenv/config";
import pg from "pg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const { Client } = pg;
const ssl = (process.env.PGSSLMODE && process.env.PGSSLMODE !== "disable")
  ? { rejectUnauthorized: false }
  : undefined;

const c = new Client({ connectionString: process.env.DATABASE_URL, ssl });
await c.connect();

// --- Counters ---
const threshold = Number(process.env.LAUNCH_THRESHOLD ?? 100000);
const { rows: t } = await c.query("select count(*)::int as n from badges");
const total_badges = t[0].n;

const { rows: ps } = await c.query(`
  select sector, count(*)::int as n
  from badges
  where status='verified'
  group by sector
  order by sector
`);
const per_sector = Object.fromEntries(ps.map(r => [r.sector, r.n]));
const percent = Math.floor((total_badges / threshold) * 100);

// --- Best bids on active auctions ---
const { rows: best } = await c.query(`
  with top_bid as (
    select b.auction_id, max(b.amount_cents)::bigint as top_amount_cents
    from bids b
    group by b.auction_id
  )
  select a.id, a.title, a.sector,
         (select count(*) from bids b where b.auction_id = a.id)::int as bids,
         tb.top_amount_cents
  from auctions a
  left join top_bid tb on tb.auction_id = a.id
  where a.status = 'active'
  order by a.created_at desc
  limit 10
`);

await c.end();

const out = {
  counters: { threshold, total_badges, percent, per_sector },
  best_bids: best.map(r => ({
    id: r.id,
    title: r.title,
    sector: r.sector,
    bids: r.bids,
    top_amount_cents: r.top_amount_cents ?? null
  }))
};

await mkdir(path.join(process.cwd(), ".cache"), { recursive: true });
await writeFile(path.join(process.cwd(), ".cache", "dashboard.json"), JSON.stringify(out, null, 2), "utf8");
console.log("OK dashboard built: .cache/dashboard.json");
