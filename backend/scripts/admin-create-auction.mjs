import https from "https";

function httpRequest({ method="GET", path="/", body=null }) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: "localhost",
      port: 4443,
      path,
      method,
      rejectUnauthorized: false,
      headers: data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}
    }, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve({ status: res.statusCode, body: d }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // 1) Login  token
  const login = await httpRequest({
    method: "POST",
    path: "/api/auth/login",
    body: { email: "admin@etika.local", password: "Admin!2025" }
  });
  const token = JSON.parse(login.body).token;
  if (!token) { console.error("Login failed:", login.body); process.exit(1); }

  // 2) POST admin  cr?ation dench?re
  const auction = await httpRequest({
    method: "POST",
    path: "/api/admin/auctions",
    body: { title: "Banque  Q4", sector: "Banque" }
  });

  // si la route admin exige l'Authorization, refais la requ?te avec l'en-t?te
  if (auction.status === 401 || auction.status === 403 || auction.body.includes("Invalid") || auction.body.includes("Missing")) {
    const auction2 = await new Promise((resolve, reject) => {
      const data = JSON.stringify({ title: "Banque  Q4", sector: "Banque" });
      const req = https.request({
        hostname: "localhost",
        port: 4443,
        path: "/api/admin/auctions",
        method: "POST",
        rejectUnauthorized: false,
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data)
        }
      }, res => {
        let d = "";
        res.on("data", c => d += c);
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      });
      req.on("error", reject);
      req.write(data);
      req.end();
    });
    console.log(auction2.body);
  } else {
    console.log(auction.body);
  }
})();
