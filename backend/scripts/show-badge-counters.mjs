import fs from "node:fs";
import { Client } from "pg";

function getEnvVal(name, fallback = null) {
  let env = "";
  try { env = fs.readFileSync(".env", "utf8").replace(/^\uFEFF/, ""); } catch {}
  if (process.env[name]) return String(process.env[name]);
  const m = env.match(new RegExp("^" + name + "\\s*=\\s*(.+)$", "m"));
  if (m) {
    let v = m[1].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return v;
  }
  return fallback;
}

const cs = getEnvVal("DATABASE_URL", "postgres://etika:etika@localhost:5432/etika");

(async () => {
  const c = new Client({ connectionString: cs });
  await c.connect();
  const r = await c.query("SELECT total_badges, per_sector FROM vw_badges_counters");
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });