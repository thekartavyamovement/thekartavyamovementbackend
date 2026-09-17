import mysql from 'mysql2/promise';
import { config } from './config/env.js';

const pool = mysql.createPool({
  host:     config.db.host,
  port:     config.db.port,
  user:     config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function testConnection() {
  const conn = await pool.getConnection();
  console.log('✅  MySQL connected successfully.');
  conn.release();
}

export default pool;
