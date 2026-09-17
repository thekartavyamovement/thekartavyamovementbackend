'use strict';

const mysql = require('mysql2/promise');

/**
 * MySQL connection pool.
 * Using a pool avoids creating a new connection on every request and
 * automatically handles reconnections on transient failures.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  database: process.env.DB_NAME || 'kartavya_movement',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  waitForConnections: true,
  queueLimit: 0,
  // Return dates as JavaScript Date objects
  dateStrings: false,
  timezone: '+00:00',
});

/**
 * Verify the connection pool is reachable at startup.
 * Logs success or a detailed error — does NOT crash the process here
 * (server.js validates env vars before this runs).
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] MySQL connection pool established successfully.');
    conn.release();
  } catch (err) {
    console.error('[DB ERROR] Could not connect to MySQL:', err.message);
    console.error('[DB ERROR] Check your DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD in .env');
  }
}

testConnection();

module.exports = pool;
