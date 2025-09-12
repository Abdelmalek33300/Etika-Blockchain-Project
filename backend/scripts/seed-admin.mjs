import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcrypt';

const email = 'admin@etika.local';
const plain = 'Admin!2025';

const { Pool } = pg;
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'etika',
  user: process.env.PGUSER || 'etika',
  password: process.env.PGPASSWORD || 'etika',
});

await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`);

const hash = await bcrypt.hash(plain, 12);
await pool.query(
  `INSERT INTO users (email,password_hash,role)
   VALUES ($1,$2,'admin')
   ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash, role='admin'`,
  [email, hash]
);

console.log('SEED_ADMIN_OK');
await pool.end();
