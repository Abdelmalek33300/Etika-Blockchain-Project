import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "etika",
  user: process.env.PGUSER || "etika",
  password: process.env.PGPASSWORD || "etika",
});

(async () => {
  try {
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name='auctions'
      ORDER BY ordinal_position
    `);
    console.log("== auctions columns ==");
    for (const r of cols.rows) {
      console.log(`${r.column_name} | ${r.data_type} | nullable=${r.is_nullable} | default=${r.column_default ?? "NULL"}`);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const r = await client.query(
        "INSERT INTO auctions (title, sector) VALUES ($1,$2) RETURNING *",
        ["__diagnostic__", "diagnostic"]
      );
      console.log("== test insert OK ==");
      console.log(r.rows[0]);
      await client.query("ROLLBACK");
    } catch (e) {
      await client.query("ROLLBACK");
      console.log("== test insert ERROR ==");
      console.log(e.message);
      if (e.code) console.log("code:", e.code);
      if (e.detail) console.log("detail:", e.detail);
      if (e.constraint) console.log("constraint:", e.constraint);
    } finally {
      client.release();
    }
  } catch (e) {
    console.log("FATAL:", e.message);
  } finally {
    await pool.end();
  }
})();
