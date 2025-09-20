import https from "https";

function http(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "localhost",
      port: 4443,
      path,
      method,
      rejectUnauthorized: false,
      headers: { "Content-Type": "application/json" },
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);

    const req = https.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: raw ? JSON.parse(raw) : null, text: raw }); }
        catch { resolve({ status: res.statusCode, json: null, text: raw }); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function httpGetAbsolute(urlStr) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const opts = {
      hostname: u.hostname,
      port: 4443,
      path: u.pathname + u.search,
      method: "GET",
      rejectUnauthorized: false,
    };
    const req = https.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: raw ? JSON.parse(raw) : null, text: raw }); }
        catch { resolve({ status: res.statusCode, json: null, text: raw }); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  const sector = process.argv[2] || "mobile";
  const email = `smoke+${Date.now()}@example.com`;

  // 1) Request email
  const r1 = await http("POST", "/api/badges/request-email", { email, sector });
  if (r1.status !== 200) {
    console.error("FAIL request-email:", r1.status, r1.text || r1.json);
    process.exit(1);
  }
  const magic = r1.json?.magic_link;
  if (!magic) {
    console.error("FAIL: magic_link absent (OK en prod, mais ce smoke attend le lien en dev).");
    process.exit(1);
  }

  // 2) Verify email (magic link)
  const r2 = await httpGetAbsolute(magic);
  if (r2.status !== 200 || !r2.json?.ok || r2.json?.badge?.status !== "verified") {
    console.error("FAIL verify-email:", r2.status, r2.text || r2.json);
    process.exit(1);
  }

  const b = r2.json.badge;
  console.log("OK smoke:", { sector: b.sector, email: b.email, status: b.status, email_verified_at: b.email_verified_at });
  process.exit(0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
