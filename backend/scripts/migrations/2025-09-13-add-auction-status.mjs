// scripts/migrations/2025-09-13-add-auction-status.mjs
// Ajoute le champ "status" (draft|active|closed|archived) et "archived_at" sur la table auctions.
// Idempotent : peut être relancé sans casser.

import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('[MIGRATION] add auction status + archived_at');
    await client.query('BEGIN');

    // 1) Colonne status
    await client.query(`ALTER TABLE auctions ADD COLUMN IF NOT EXISTS status text`);
    await client.query(`ALTER TABLE auctions ALTER COLUMN status SET DEFAULT 'active'`);
    await client.query(`UPDATE auctions SET status = 'active' WHERE status IS NULL`);

    // 2) Contrainte de valeurs autorisées (si absente)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM   pg_constraint
          WHERE  conname = 'auctions_status_check'
        ) THEN
          ALTER TABLE auctions
          ADD CONSTRAINT auctions_status_check
          CHECK (status IN ('draft','active','closed','archived'));
        END IF;
      END
      $$;
    `);

    // 3) Colonne archived_at
    await client.query(`ALTER TABLE auctions ADD COLUMN IF NOT EXISTS archived_at timestamptz`);

    // 4) Index utile (optionnel)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = 'idx_auctions_status' AND n.nspname = 'public'
        ) THEN
          CREATE INDEX idx_auctions_status ON auctions(status);
        END IF;
      END
      $$;
    `);

    await client.query('COMMIT');
    console.log('✅ MIGRATION OK');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ MIGRATION FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
