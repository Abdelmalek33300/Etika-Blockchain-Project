import https from "node:https";

// Usage: node scripts/get-bids-params.mjs <auctionId> [limit=5] [sort=amount|amount_cents|created_at] [order=asc|desc] [page=1]
const [,, id, limit="5", sort="amount", order="desc", page="1"] = process.argv;
if (!id) { console.error("Usage: node scripts/get-bids-params.mjs <auctionId> [limit] [sort] [order] [page]"); process.exit(1); }

const path = `/api/auctions/${encodeURIComponent(id)}/bids?limit=${encodeURIComponent(limit)}&sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}&page=${encodeURIComponent(page)}`;

const req = https.request(
  { hostname:"localhost", port:4443, path, method:"GET", rejectUnauthorized:false },
  (res) => {
    let body = "";
    process.stdout.write(`HTTP ${res.statusCode}\n`);
    res.setEncoding("utf8");
    res.on("data", c => body += c);
    res.on("end", () => {
      try {
        const json = JSON.parse(body);
        if (res.statusCode === 200 && json && typeof json === "object") {
          if (json.total !== undefined) {
            console.log(`total=${json.total} page=${json.page}/${json.pages} limit=${json.limit} sort=${json.sort} order=${json.order}`);
          }
        }
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log(body); // pas du JSON (ex: HTML derreur)
      }
    });
  }
);
req.on("error", e => console.error("ERR", e.message));
req.end();