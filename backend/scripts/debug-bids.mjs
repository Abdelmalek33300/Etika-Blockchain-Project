import pg from 'pg';
const { Client } = pg;

const auctionId = '976b4adb-2c8a-4a04-b439-830ef7c4c15d';

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

  console.log('--- Sanity checks ---');
  const c1 = await client.query('SELECT COUNT(*)::int AS n FROM bids WHERE auction_id = $1', [auctionId]);
  console.log('bids for auction_id =', c1.rows[0].n);

  console.log('--- Sample rows ---');
  const r1 = await client.query(
    `SELECT id, auction_id, bidder, amount, created_at
     FROM bids
     WHERE auction_id = $1
     ORDER BY created_at DESC NULLS LAST, id
     LIMIT 10`,
    [auctionId]
  );
  console.log(r1.rows);

  await client.end();
})().catch(e => {
  console.error('DEBUG FAILED:', e.message);
  console.error(e.stack);
  process.exit(1);
});
