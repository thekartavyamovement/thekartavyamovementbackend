'use strict';

/**
 * Database setup script.
 * Run once to create the database and tables:
 *   npm run db:setup
 *
 * This script connects using the credentials in .env, creates the database
 * if it does not exist, then creates the enquiries table.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'kartavya_movement';

async function setup() {
  // Connect without a database first so we can create it
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  console.log(`[SETUP] Connected to MySQL at ${process.env.DB_HOST}`);

  // Create database
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`[SETUP] Database '${DB_NAME}' is ready.`);

  // Switch to the database
  await conn.query(`USE \`${DB_NAME}\``);

  // Create enquiries table
  await conn.query(`
    CREATE TABLE IF NOT EXISTS enquiries (
      id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
      name         VARCHAR(120)   NOT NULL,
      email        VARCHAR(254)   NOT NULL,
      subject      VARCHAR(255)   NOT NULL,
      message      TEXT           NOT NULL,
      status       ENUM('new', 'read', 'replied', 'archived')
                                  NOT NULL DEFAULT 'new',
      ip_address   VARCHAR(45)    NULL COMMENT 'IPv4 or IPv6 of submitter',
      user_agent   VARCHAR(512)   NULL,
      created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_email      (email),
      INDEX idx_status     (status),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log(`[SETUP] Table 'enquiries' is ready.`);

  await conn.end();
  console.log('[SETUP] Database setup complete. ✓');
}

setup().catch((err) => {
  console.error('[SETUP ERROR]', err.message);
  process.exit(1);
});
