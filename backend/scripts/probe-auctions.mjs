import https from "node:https";

function doGet(path){
  return new Promise((resolve)=>{
    const req = https.request(
      { hostname:"localhost", port:4443, path, method:"GET", rejectUnauthorized:false },
      res => {
        let body=""; res.on("data",c=>body+=c); res.on("end",()=>resolve({path,code:res.statusCode,body}));
      }
    );
    req.on("error",e=>resolve({path,code:0,body:"ERR "+e.message}));
    req.end();
  });
}

const paths = [
  "/api/auctions?status=all&limit=5",
  "/api/api/auctions?status=all&limit=5"
];

(async ()=>{
  for (const p of paths){
    const r = await doGet(p);
    console.log("PATH", p, "-> HTTP", r.code);
    console.log(r.body, "\n");
  }
})();