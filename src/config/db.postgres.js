'use strict';

/**
 * PostgreSQL adapter.
 * Wraps the `pg` Pool to expose the same unified DB interface as db.mysql.js:
 *
 *   adapter.query(sql, params)  → { rows, rowCount, insertId }
 *   adapter.getClient()         → client with { query, release }
 *   adapter.end()               → drains the pool (used by setup scripts)
 *
 * SQL dialect used here: PostgreSQL
 *   - Placeholders : $1, $2, $3 …  (converted from ? by parameterisePlaceholders)
 *   - Auto-increment: SERIAL / BIGSERIAL, last id via RETURNING id
 *   - Status type  : TEXT with CHECK constraint (no native ENUM needed)
 *   - String trunc : SUBSTRING(col FROM 1 FOR n)
 *   - Timestamps   : TIMESTAMPTZ DEFAULT NOW()
 *
 * NOTE: The controller uses driver-agnostic helpers (see db.js) to build SQL,
 * so it never embeds ? or $n directly — this adapter handles the translation.
 */

const { Pool } = require('pg');

// ── Build connection config ─────────────────────────────────────────────────
// Accept either a full DATABASE_URL (Render / Supabase / Railway supply this)
// or individual DB_* variables — whichever is present in .env.
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      // Render / Supabase require SSL in production
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME     || 'kartavya_movement',
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max:      parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
      ssl:      process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    };

const pool = new Pool(poolConfig);

// ── Test connection at startup ─────────────────────────────────────────────
(async () => {
  try {
    const client = await pool.connect();
    console.log('[DB] PostgreSQL pool connected successfully.');
    client.release();
  } catch (err) {
    console.error('[DB ERROR] PostgreSQL connection failed:', err.message);
  }
})();

// ── Placeholder translation ────────────────────────────────────────────────
/**
 * Convert a MySQL-style query (? placeholders) to PostgreSQL style ($1, $2 …).
 * This keeps SQL strings in the controller readable and database-agnostic.
 *
 * @param {string} sql - SQL string with ? placeholders
 * @returns {string}   - SQL string with $1, $2 … placeholders
 */
function toPostgresPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// ── Unified interface ──────────────────────────────────────────────────────

/**
 * Run a single query and return a normalised result.
 * @param {string} sql     - SQL with ? placeholders (auto-converted to $n)
 * @param {Array}  params  - Ordered parameter values
 * @returns {{ rows: object[], rowCount: number, insertId: number|null }}
 */
async function query(sql, params = []) {
  const pgSql = toPostgresPlaceholders(sql);
  const result = await pool.query(pgSql, params);

  // Extract the inserted ID if this was an INSERT … RETURNING id
  const insertId = result.rows?.[0]?.id ?? null;

  return {
    rows:     result.rows     || [],
    rowCount: result.rowCount || 0,
    insertId,
  };
}

/**
 * Acquire a dedicated client from the pool.
 * Used for multi-step operations on the same connection.
 * Caller MUST call client.release() when done.
 *
 * @returns {{ query: Function, release: Function }}
 */
async function getClient() {
  const client = await pool.connect();

  return {
    async query(sql, params = []) {
      const pgSql = toPostgresPlaceholders(sql);
      const result = await client.query(pgSql, params);

      const insertId = result.rows?.[0]?.id ?? null;

      return {
        rows:     result.rows     || [],
        rowCount: result.rowCount || 0,
        insertId,
      };
    },
    release() {
      client.release();
    },
  };
}

/**
 * Drain the pool — used by the setup script after it finishes.
 */
async function end() {
  await pool.end();
}

module.exports = { query, getClient, end, driver: 'postgres' };
