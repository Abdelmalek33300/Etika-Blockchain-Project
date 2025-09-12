import https from "https";
function req({method="GET",path="/",body,headers={}}){return new Promise((ok,ko)=>{const data=body?JSON.stringify(body):null;const r=https.request({hostname:"localhost",port:4443,path,method,rejectUnauthorized:false,headers:data?{...headers,"Content-Type":"application/json","Content-Length":Buffer.byteLength(data)}:headers},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>ok({status:res.statusCode,body:d}))});r.on("error",ko);if(data)r.write(data);r.end();});}
const login = await req({method:"POST",path:"/api/auth/login",body:{email:"admin@etika.local",password:"Admin!2025"}});
const token = JSON.parse(login.body).token;
const del = await req({method:"DELETE",path:"/api/admin/auctions/2c3f2d53-5702-4691-9179-89eb47e0ed54",headers:{Authorization:"Bearer "+token}});
console.log(del.body);
