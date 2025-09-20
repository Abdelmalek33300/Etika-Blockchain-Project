import https from "node:https";
const req = https.request(
  { hostname: "localhost", port: 4443, path: "/api/public/counters-fast", method: "GET", rejectUnauthorized: false },
  (res) => {
    let body = "";
    process.stdout.write("HTTP " + res.statusCode + "\n");
    res.on("data", (c) => (body += c));
    res.on("end", () => console.log(body));
  }
);
req.on("error", (e) => console.error("ERR", e.message));
req.end();