import pg from 'pg';
const c = new pg.Client({ host:'localhost', port:5432, database:'etika', user:'etika', password:'etika' });
(async () => {
  await c.connect();
  const r = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name='bids'
    ORDER BY ordinal_position
  `);
  console.table(r.rows);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
