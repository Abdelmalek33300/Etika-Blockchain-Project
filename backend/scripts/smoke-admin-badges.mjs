import https from "https";

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("ERR: missing TOKEN env (admin JWT)");
  process.exit(1);
}

function get(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "localhost",
      port: 4443,
      path,
      method: "GET",
      rejectUnauthorized: false,
      headers: { Authorization: "Bearer " + TOKEN },
    };
    const req = https.request(opts, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, json: raw ? JSON.parse(raw) : null, text: raw });
        } catch {
          resolve({ status: res.statusCode, json: null, text: raw });
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  const r = await get("/api/admin/badges?status=verified&limit=5&sort=verified_at&order=desc");
  if (r.status !== 200 || !r.json?.ok) {
    console.error("FAIL:", r.status, r.text || r.json);
    process.exit(1);
  }
  const items = r.json.items || [];
  console.log("OK admin badges (latest verified):");
  for (const it of items) {
    console.log(`- ${it.id} | ${it.sector} | ${it.verified_at}`);
  }
  process.exit(0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
