import pg from 'pg';
const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'etika',
  user: process.env.PGUSER || 'etika',
  password: process.env.PGPASSWORD || 'etika',
  ssl: false,
});
