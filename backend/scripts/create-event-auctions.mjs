import https from "https";

const TOKEN = process.env.TOKEN;
if (!TOKEN) {
  console.error("ERR: missing TOKEN env (admin JWT)");
  process.exit(1);
}

const sectors = [
  ["mobile",          "Téléphonie mobile"],
  ["box_internet",    "Box internet"],
  ["bank",            "Banque"],
  ["insurance",       "Assurance"],
  ["mutual",          "Mutuelle"],
  ["payment_card",    "Carte de paiement"],
  ["vod",             "VOD"],
  ["electricity","Électricité"],
  ["search_engine",   "Moteur de recherche"],
];

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: "localhost",
      port: 4443,
      path,
      method,
      rejectUnauthorized: false,
      headers: {
        Authorization: "Bearer " + TOKEN,
        "Content-Type": "application/json",
      },
    };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);

    const r = https.request(opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, json: d ? JSON.parse(d) : null }); }
        catch { resolve({ status: res.statusCode, text: d }); }
      });
    });
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  // 1) Récupérer les enchères existantes (all)
  const list = await req("GET", "/api/admin/auctions?status=all&limit=200");
  const items = list?.json?.items ?? [];

  const results = [];
  for (const [slug, label] of sectors) {
    const has = items.some(a =>
      String(a.sector || "").toLowerCase() === slug ||
      String(a.title || "").toLowerCase().includes(label.toLowerCase())
    ) && items.some(a => String(a.title || "").toLowerCase().includes(label.toLowerCase()) ? a.status !== "archived" : false);

    if (has) {
      results.push({ sector: slug, title: label, action: "skip_existing" });
      continue;
    }
    const title = `EVT-1  ${label}`;
    const created = await req("POST", "/api/admin/auctions", { title, sector: slug });
    results.push({ sector: slug, title, action: created.status, body: created.json ?? created.text });
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
})().catch(e => {
  console.error("ERR", e.message);
  process.exit(1);
});

