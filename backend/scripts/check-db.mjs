import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'etika',
  user: process.env.PGUSER || 'etika',
  password: process.env.PGPASSWORD || 'etika',
  ssl: false,
});

(async () => {
  await client.connect();
  const r1 = await client.query('SELECT COUNT(*) AS n FROM auctions');
  const r2 = await client.query('SELECT COUNT(*) AS n FROM bids');
  const r3 = await client.query(`
    SELECT a.id AS auction_id, COALESCE(a.title,'') AS title, COUNT(b.id)::int AS nb_bids
    FROM auctions a
    LEFT JOIN bids b ON b.auction_id = a.id
    GROUP BY a.id, a.title
    ORDER BY nb_bids DESC, a.id
    LIMIT 10
  `);

  console.log('Auctions =', r1.rows[0].n);
  console.log('Bids     =', r2.rows[0].n);
  console.log('Top auctions by bids:');
  for (const row of r3.rows) {
    console.log(` - ${row.auction_id} | ${row.title} | bids=${row.nb_bids}`);
  }

  await client.end();
})().catch((e) => {
  console.error('Check failed:', e.message);
  process.exit(1);
});
