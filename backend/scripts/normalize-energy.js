const { Client } = require('pg');

(async () => {
  const c = new Client(); // lit PGHOST/PGUSER/PGPASSWORD/PGDATABASE depuis l'env
  await c.connect();

  await c.query("UPDATE auctions SET sector='electricity' WHERE sector='energy';");
  await c.query("UPDATE badges   SET sector='electricity' WHERE sector='energy';");

  const r = await c.query(
    SELECT 'auctions' AS table,
           COUNT(*) FILTER (WHERE sector='energy') AS energy_left,
           COUNT(*) FILTER (WHERE sector='electricity') AS electricity_count
    FROM auctions
    UNION ALL
    SELECT 'badges',
           COUNT(*) FILTER (WHERE sector='energy'),
           COUNT(*) FILTER (WHERE sector='electricity')
    FROM badges;
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
