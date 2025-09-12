// scripts/db-test.mjs
// Petit test de connexion à PostgreSQL (ESM)

import pg from 'pg';
const { Client } = pg;

// Connexion locale créée précédemment
const CONN = process.env.PG_CONN
  || 'postgres://etika:etika@localhost:5432/etika?sslmode=disable';

async function main() {
  const client = new Client({ connectionString: CONN });
  try {
    await client.connect();
    console.log('✅ Connecté à Postgres');
    const res = await client.query('SELECT current_database() db, version();');
    console.log('DB =', res.rows[0].db);
    console.log(res.rows[0].version);
  } catch (err) {
    console.error('❌ Connexion/Query a échoué :', err.message);
    process.exitCode = 1;
  } finally {
    try { await client.end(); } catch {}
  }
}

main();
