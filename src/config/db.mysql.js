'use strict';

/**
 * MySQL adapter.
 * Wraps mysql2/promise pool to expose the unified DB interface:
 *
 *   adapter.query(sql, params)  → { rows, rowCount }
 *   adapter.getClient()         → client with { query, release }
 *   adapter.end()               → drains the pool (used by setup scripts)
 *
 * SQL dialect used here: MySQL
 *   - Placeholders : ?
 *   - Auto-increment: AUTO_INCREMENT / LAST_INSERT_ID()
 *   - Status type  : ENUM(...)
 *   - String trunc : LEFT(col, n)
 *   - Timestamps   : DATETIME DEFAULT CURRENT_TIMESTAMP
 */

const mysql = require('mysql2/promise');

// ── Create pool ────────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:            process.env.DB_HOST || 'localhost',
  port:            parseInt(process.env.DB_PORT || '3306', 10),
  database:        process.env.DB_NAME || 'kartavya_movement',
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  waitForConnections: true,
  queueLimit:      0,
  dateStrings:     false,
  timezone:        '+00:00',
});

// ── Test connection at startup ─────────────────────────────────────────────
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] MySQL pool connected successfully.');
    conn.release();
  } catch (err) {
    console.error('[DB ERROR] MySQL connection failed:', err.message);
  }
})();

// ── Unified interface ──────────────────────────────────────────────────────

/**
 * Run a single query and return a normalised result.
 * @param {string} sql     - MySQL SQL string with ? placeholders
 * @param {Array}  params  - Ordered parameter values
 * @returns {{ rows: object[], rowCount: number, insertId: number|null }}
 */
async function query(sql, params = []) {
  const [result] = await pool.execute(sql, params);

  // INSERT / UPDATE / DELETE → result is an OkPacket (no rows array)
  if (!Array.isArray(result)) {
    return {
      rows:     [],
      rowCount: result.affectedRows,
      insertId: result.insertId || null,
    };
  }

  // SELECT → result is RowDataPacket[]
  return {
    rows:     result,
    rowCount: result.length,
    insertId: null,
  };
}

/**
 * Acquire a dedicated connection from the pool.
 * Used for multi-step transactions or sequential queries on the same connection.
 * Caller MUST call client.release() when done.
 *
 * @returns {{ query: Function, release: Function }}
 */
async function getClient() {
  const conn = await pool.getConnection();

  return {
    /**
     * @param {string} sql
     * @param {Array}  params
     */
    async query(sql, params = []) {
      const [result] = await conn.execute(sql, params);

      if (!Array.isArray(result)) {
        return {
          rows:     [],
          rowCount: result.affectedRows,
          insertId: result.insertId || null,
        };
      }

      return {
        rows:     result,
        rowCount: result.length,
        insertId: null,
      };
    },
    release() {
      conn.release();
    },
  };
}

/**
 * Drain the pool — used by the setup script after it finishes.
 */
async function end() {
  await pool.end();
}

module.exports = { query, getClient, end, driver: 'mysql' };
