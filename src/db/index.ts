import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`[db] missing env: ${key}`);
  }
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
});

export async function checkDbConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
