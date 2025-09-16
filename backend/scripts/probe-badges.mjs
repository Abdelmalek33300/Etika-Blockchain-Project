import { Client } from "pg";

const cfg = {
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "etika",
  user: process.env.PGUSER || "etika",
  password: process.env.PGPASSWORD || "etika",
  ssl: false,
};

(async () => {
  const c = new Client(cfg);
  await c.connect();
  const out = {};

  out.tables = (await c.query(
    "select table_name from information_schema.tables where table_schema='public' and table_name in ('badges','badge_verifications','auctions','bids') order by table_name"
  )).rows;

  out.view = (await c.query(
    "select viewname from pg_views where schemaname='public' and viewname='vw_badges_counters'"
  )).rows;

  out.triggers = (await c.query(
    "select tgname from pg_trigger where not tgisinternal and tgname in ('t_bu_set_verified_at','t_au_badges') order by tgname"
  )).rows;

  for (const t of ["badges","badge_verifications"]) {
    const exists = (await c.query("select to_regclass($1) is not null as exists", [`public.${t}`])).rows[0].exists;
    if (exists) {
      const cnt = await c.query(`select count(*)::int as n from ${t}`);
      out["count_" + t] = cnt.rows[0].n;
    }
  }

  console.log(JSON.stringify(out, null, 2));
  await c.end();
})().catch(e => {
  console.error("ERR", e.message);
  process.exit(1);
});
