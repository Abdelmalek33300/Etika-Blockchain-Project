import https from "https";

const data = JSON.stringify({ email: "admin@etika.local", password: "Admin!2025" });

const req = https.request({
  hostname: "localhost",
  port: 4443,
  path: "/api/auth/login",
  method: "POST",
  rejectUnauthorized: false,
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
}, res => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => { try { const j = JSON.parse(d); console.log(j.token || d); } catch { console.log(d); } });
});
req.on("error", e => { console.error(e.message); process.exit(1); });
req.write(data);
req.end();
