import https from "https";
function req({ method="GET", path="/", body=null, headers={} }) {
  return new Promise((ok, ko) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request({ hostname:"localhost", port:4443, path, method, rejectUnauthorized:false, headers: data ? { ...headers, "Content-Type":"application/json", "Content-Length":Buffer.byteLength(data) } : headers }, res => {
      let d=""; res.on("data", c => d+=c); res.on("end", () => ok({ status: res.statusCode, body: d }));
    });
    r.on("error", ko); if (data) r.write(data); r.end();
  });
}
(async ()=>{
  const login = await req({ method:"POST", path:"/api/auth/login", body:{ email:"admin@etika.local", password:"Admin!2025" }});
  const token = JSON.parse(login.body).token;
  const bad = await req({ method:"POST", path:"/api/admin/auctions", headers:{ Authorization:"Bearer "+token }, body:{ title:"", sector:"" }});
  console.log(bad.status, bad.body);
})();
