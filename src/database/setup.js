'use strict';

/**
 * Database setup script — works for BOTH MySQL and PostgreSQL.
 *
 * Usage:
 *   npm run db:setup              ← uses DB_DRIVER from .env (default: mysql)
 *   npm run db:setup:mysql        ← forces MySQL
 *   npm run db:setup:postgres     ← forces PostgreSQL
 *
 * Or directly:
 *   node src/database/setup.js
 *   DB_DRIVER=postgres node src/database/setup.js
 *
 * What it does:
 *   MySQL    — creates the database if it doesn't exist, then the enquiries table.
 *   Postgres — assumes the database already exists (Render/Supabase/PlanetScale
 *              provision it for you); runs the DDL from schema.postgres.sql.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const DRIVER = (process.env.DB_DRIVER || 'mysql').toLowerCase().trim();

console.log(`[SETUP] Running setup for driver: ${DRIVER}`);

if (DRIVER === 'postgres') {
  setupPostgres().catch((err) => {
    console.error('[SETUP ERROR]', err.message);
    process.exit(1);
  });
} else {
  setupMySQL().catch((err) => {
    console.error('[SETUP ERROR]', err.message);
    process.exit(1);
  });
}

// ── MySQL setup ────────────────────────────────────────────────────────────
async function setupMySQL() {
  const mysql  = require('mysql2/promise');
  const DB_NAME = process.env.DB_NAME || 'kartavya_movement';

  // Connect without selecting a database first — so we can create it
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  console.log(`[SETUP] Connected to MySQL at ${process.env.DB_HOST}`);

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`[SETUP] Database '${DB_NAME}' ready.`);

  await conn.query(`USE \`${DB_NAME}\``);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
      name         VARCHAR(120)   NOT NULL,
      email        VARCHAR(254)   NOT NULL,
      subject      VARCHAR(255)   NOT NULL,
      message      TEXT           NOT NULL,
      status       ENUM('new', 'read', 'replied', 'archived')
                                  NOT NULL DEFAULT 'new',
      ip_address   VARCHAR(45)    NULL     COMMENT 'IPv4 or IPv6 of submitter',
      user_agent   VARCHAR(512)   NULL,
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY  (id),
      INDEX idx_email      (email),
      INDEX idx_status     (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log(`[SETUP] Table 'enquiries' ready.`);

  await conn.end();
  console.log('[SETUP] MySQL setup complete. ✓');
}

// ── PostgreSQL setup ───────────────────────────────────────────────────────
async function setupPostgres() {
  const { Client } = require('pg');

  // Build connection config — prefer DATABASE_URL if present
  const config = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME     || 'kartavya_movement',
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl:      process.env.DB_SSL === 'true'
          ? { rejectUnauthorized: false }
          : false,
      };

  const client = new Client(config);
  await client.connect();
  console.log(`[SETUP] Connected to PostgreSQL at ${process.env.DB_HOST || 'DATABASE_URL'}`);

  // ── enquiries table ──────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id           BIGSERIAL      PRIMARY KEY,
      name         VARCHAR(120)   NOT NULL,
      email        VARCHAR(254)   NOT NULL,
      subject      VARCHAR(255)   NOT NULL,
      message      TEXT           NOT NULL,
      status       TEXT           NOT NULL DEFAULT 'new'
                                  CHECK (status IN ('new', 'read', 'replied', 'archived')),
      ip_address   VARCHAR(45),
      user_agent   VARCHAR(512),
      created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
    )
  `);
  console.log(`[SETUP] Table 'enquiries' ready.`);

  // ── updated_at trigger ───────────────────────────────────────────────────
  await client.query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$
  `);

  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_enquiries_updated_at'
      ) THEN
        CREATE TRIGGER trg_enquiries_updated_at
          BEFORE UPDATE ON enquiries
          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END $$
  `);
  console.log(`[SETUP] updated_at trigger ready.`);

  // ── indexes ──────────────────────────────────────────────────────────────
  await client.query(`CREATE INDEX IF NOT EXISTS idx_enquiries_email      ON enquiries (email)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_enquiries_status     ON enquiries (status)`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_enquiries_created_at ON enquiries (created_at DESC)`);
  console.log(`[SETUP] Indexes ready.`);

  await client.end();
  console.log('[SETUP] PostgreSQL setup complete. ✓');
}
