import https from "node:https";
https.get(
  { hostname:"localhost", port:4443, path:"/api/public/counters", rejectUnauthorized:false },
  res => {
    let body = "";
    process.stdout.write(`HTTP ${res.statusCode}\n`);
    res.setEncoding("utf8");
    res.on("data", d => body += d);
    res.on("end", () => {
      try {
        const json = JSON.parse(body);
        console.log(JSON.stringify(json, null, 2));
      } catch {
        console.log(body);
      }
    });
  }
).on("error", e => console.error("ERR", e.message));