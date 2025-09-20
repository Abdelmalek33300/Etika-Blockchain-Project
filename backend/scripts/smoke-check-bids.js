// backend/scripts/smoke-check-bids.js (ESM)  logs stables dans backend/.logs
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const backendDir = path.resolve(__dirname, "..");
const logsDir    = path.join(backendDir, ".logs");

const auctionId = process.argv[2] || process.env.AUCTION_ID;
if (!auctionId) {
  console.error("Usage: node backend/scripts/smoke-check-bids.js <AUCTION_UUID>");
  process.exit(2);
}

const agent = new https.Agent({ rejectUnauthorized: false });
const options = {
  hostname: "localhost",
  port: 4443,
  path: `/api/public/auctions/${auctionId}/bids`,
  method: "GET",
  agent,
  headers: { Accept: "application/json" },
};

function log(line) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
    const file = path.join(logsDir, "smoke-bids.log");
    fs.appendFileSync(file, line + "\n", "utf8");
  } catch (e) {
    console.error("[log_error]", e?.message || e);
  }
}

const startedAt = new Date().toISOString();
const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    try {
      const parsed = JSON.parse(data || "null");
      const ok = res.statusCode === 200 && Array.isArray(parsed);
      const count = Array.isArray(parsed) ? parsed.length : -1;
      const line = `[${startedAt}] status=${res.statusCode} array=${Array.isArray(parsed)} count=${count}`;
      console.log(line);
      log(line);
      if (!ok) process.exit(1);
      process.exit(count > 0 ? 0 : 1);
    } catch (e) {
      const line = `[${startedAt}] parse_error: ${e?.message || e}`;
      console.error(line);
      log(line);
      process.exit(1);
    }
  });
});

req.on("error", (e) => {
  const line = `[${startedAt}] request_error: ${e?.message || e}`;
  console.error(line);
  log(line);
  process.exit(1);
});

req.end();
