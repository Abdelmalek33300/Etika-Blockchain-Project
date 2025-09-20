import https from "node:https";
const id = process.argv[2];
if (!id) { console.error("Usage: node scripts/get-bids.mjs <auctionId>"); process.exit(1); }
const path = `/api/auctions/${id}/bids?limit=5&sort=amount&order=desc`;
const req = https.request(
  { hostname:"localhost", port:4443, path, method:"GET", rejectUnauthorized:false },
  (res) => { let body=""; process.stdout.write("HTTP "+res.statusCode+"\n");
    res.on("data", c => body+=c); res.on("end", () => console.log(body)); }
);
req.on("error", e => console.error("ERR", e.message));
req.end();