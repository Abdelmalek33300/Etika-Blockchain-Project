import https from "https";

function req({ method="GET", path="/", body=null, headers={} }) {
  return new Promise((ok, ko) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: "localhost", port: 4443, path, method, rejectUnauthorized: false,
      headers: data ? { ...headers, "Content-Type":"application/json","Content-Length":Buffer.byteLength(data) } : headers
    }, res => { let d=""; res.on("data", c => d+=c); res.on("end", () => ok({ status: res.statusCode, body: d })); });
    r.on("error", ko); if (data) r.write(data); r.end();
  });
}

const out = [];
try {
  // 1) health
  const health = await req({ path: "/api/health" });
  out.push(["health", health.status, health.body]);

  // 2) login -> token
  const login = await req({ method:"POST", path:"/api/auth/login", body:{ email:"admin@etika.local", password:"Admin!2025" } });
  const token = JSON.parse(login.body).token;
  out.push(["login", login.status, token ? "TOKEN_OK" : login.body]);
  if (!token) throw new Error("Login failed");

  // 3) create auction
  const title = "smoke-" + Date.now();
  const create = await req({ method:"POST", path:"/api/admin/auctions", body:{ title, sector:"Test" }, headers:{ Authorization:"Bearer "+token }});
  const created = JSON.parse(create.body);
  out.push(["create", create.status, created.id || create.body]);
  if (!created.id) throw new Error("Create failed: " + create.body);

  // 4) list auctions (ensure visible)
  const list = await req({ path:"/api/auctions" });
  const visible = list.body.includes(created.id);
  out.push(["list", list.status, visible ? "VISIBLE" : "NOT_FOUND"]);

  // 5) delete created
  const del = await req({ method:"DELETE", path:`/api/admin/auctions/${created.id}`, headers:{ Authorization:"Bearer "+token }});
  out.push(["delete", del.status, del.body]);

  // 6) delete should-block (has bids)
  const knownWithBids = "2c3f2d53-5702-4691-9179-89eb47e0ed54";
  const delBlock = await req({ method:"DELETE", path:`/api/admin/auctions/${knownWithBids}`, headers:{ Authorization:"Bearer "+token }});
  out.push(["delete-block", delBlock.status, delBlock.body]);

  console.table(out);
} catch (e) {
  console.error("SMOKE_ERROR:", e.message);
  console.table(out);
  process.exit(1);
}
