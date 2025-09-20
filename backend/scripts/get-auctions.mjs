import https from "node:https";

const path = "/api/auctions?status=all&limit=5";
const req = https.request(
  { hostname: "localhost", port: 4443, path, method: "GET", rejectUnauthorized: false },
  (res) => {
    let body = "";
    process.stdout.write(`HTTP ${res.statusCode}\n`);
    res.setEncoding("utf8");
    res.on("data", (c) => body += c);
    res.on("end", () => {
      try {
        const json = JSON.parse(body);
        if (res.statusCode === 200 && json && typeof json === "object") {
          if (json.total !== undefined) {
            console.log(`total=${json.total} page=${json.page}/${json.pages} limit=${json.limit} sort=${json.sort} order=${json.order} status=${json.status}`);
          }
        }
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log(body);
      }
    });
  }
);
req.on("error", (e) => console.error("ERR", e.message));
req.end();