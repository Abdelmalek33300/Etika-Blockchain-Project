import https from "https";

function loginWrong(i){
  return new Promise((ok,ko)=>{
    const body = JSON.stringify({ email:"admin@etika.local", password:"WRONG!" });
    const r = https.request({
      hostname:"localhost", port:4443, path:"/api/auth/login", method:"POST",
      rejectUnauthorized:false,
      headers:{ "Content-Type":"application/json", "Content-Length":Buffer.byteLength(body) }
    }, res => { res.resume(); res.on("end",()=>ok(res.statusCode)); });
    r.on("error",ko); r.write(body); r.end();
  });
}

(async ()=>{
  const statuses=[];
  for(let i=1;i<=12;i++){
    const s = await loginWrong(i);
    statuses.push(s);
    console.log(`#${i}: ${s}`);
    await new Promise(r=>setTimeout(r,100)); // petit délai
  }
  const counts = statuses.reduce((m,s)=>((m[s]=(m[s]||0)+1),m),{});
  console.log("summary:", counts);
})();
