import { Agent, setGlobalDispatcher } from "undici";
setGlobalDispatcher(new Agent({ connect: { rejectUnauthorized: false } }));

const base = process.env.BASE_URL || "https://localhost:4443";
const origin = process.env.SMOKE_ORIGIN || "http://localhost:5173";

const fail = (msg, extra) => { console.error("FAIL:", msg, extra ?? ""); process.exit(1); };

try {
  const res = await fetch(`${base}/api/public/dashboard`, { headers: { Origin: origin } });
  if (!res.ok) fail(`HTTP ${res.status}`);

  const allow = res.headers.get("access-control-allow-origin");
  if (allow !== origin) fail("CORS header mismatch", { expect: origin, got: allow });

  const data = await res.json();
  if (!data || typeof data !== "object") fail("Invalid JSON body");
  if (!data.counters) fail("Missing 'counters'");
  if (!Array.isArray(data.best_bids)) fail("Missing 'best_bids' array");

  console.log("OK dashboard smoke ");
  console.log(`- CORS: ${allow}`);
  console.log(`- total_badges: ${data.counters.total_badges}`);
  console.log(`- best_bids: ${data.best_bids.length} items`);
} catch (e) { fail(e.message); }
