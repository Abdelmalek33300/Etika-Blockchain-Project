import { Client } from "pg";

const cfg = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false }
  : { host: process.env.PGHOST || "localhost", port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE || "etika", user: process.env.PGUSER || "etika", password: process.env.PGPASSWORD || "etika" };

(async () => {
  const c = new Client(cfg);
  await c.connect();
  const q = `
    select column_name
    from information_schema.columns
    where table_schema='public' and table_name='badges'
      and column_name in ('email','phone','email_verified_at','phone_verified_at')
    order by column_name
  `;
  const r = await c.query(q);
  console.log(r.rows);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
