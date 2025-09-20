import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: `${__dirname}\\..\\.env` });

function mask(v){ if(!v && v!==0) return "(absent)";
  const s=String(v); if(s.length<=4) return "***";
  return s.slice(0,2)+"***"+s.slice(-2);
}

const keys = ["DATABASE_URL","PGHOST","PGPORT","PGDATABASE","PGUSER","PGPASSWORD"];
const report = Object.fromEntries(keys.map(k => [k, mask(process.env[k])]));

console.log("ENV CHECK:", JSON.stringify(report, null, 2));
