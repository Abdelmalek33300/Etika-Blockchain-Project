// backend/scripts/probe-dashboard.mjs
// Objectif : appeler l'API HTTPS locale /api/public/dashboard (cert self-signed),
// afficher Cache-Control et last_updated. À utiliser dans les logs d'ops.
//
// Usage : node backend/scripts/probe-dashboard.mjs

import https from "https";

function fetchDashboard() {
  return new Promise((resolve, reject) => {
    const req = https.get(
      {
        hostname: "localhost",
        port: 4443,
        path: "/api/public/dashboard",
        rejectUnauthorized: false, // TLS local
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const cc = res.headers["cache-control"] || "";
            const ts = json?.last_updated || "(no last_updated)";
            console.log(`[probe] Cache-Control: ${cc}`);
            console.log(`[probe] last_updated: ${ts}`);
            resolve();
          } catch (e) {
            console.log("[probe] ERROR: invalid JSON response");
            console.log(data);
            reject(e);
          }
        });
      }
    );
    req.on("error", (err) => reject(err));
  });
}

fetchDashboard().catch((err) => {
  console.error("[probe] ERROR:", err?.message || err);
  process.exit(1);
});
