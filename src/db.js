import mysql from "mysql2/promise";
import dotenv from "dotenv";

// 确保环境变量已加载（server.js 已经加载，这里再次确保）
dotenv.config();

// 添加调试日志，确认环境变量是否正确加载
console.log('[DB] 创建连接池，DB_HOST:', process.env.DB_HOST);
console.log('[DB] DB_PORT:', process.env.DB_PORT);
console.log('[DB] DB_USER:', process.env.DB_USER);
console.log('[DB] DB_NAME:', process.env.DB_NAME);

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 20, // 增加连接数
  connectTimeout: 30000, // 连接超时时间（30 秒）
  enableKeepAlive: true, // 启用 keep-alive
  keepAliveInitialDelay: 0, // keep-alive 初始延迟
  waitForConnections: true, // 等待连接可用
  queueLimit: 0, // 无限制队列
});

// 在连接池创建后立即测试连接（不阻塞服务器启动）
setTimeout(() => {
  pool.getConnection()
    .then(connection => {
      console.log('[DB] ✅ 连接池连接测试成功');
      connection.release();
    })
    .catch(error => {
      console.error('[DB] ❌ 连接池连接测试失败:', error.code, error.message);
      console.error('[DB] 注意：服务器将继续运行，但数据库相关功能可能不可用');
    });
}, 100);



