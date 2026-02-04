import dotenv from "dotenv";
import app from "./app.js";
import { ensureSyncSchema } from "./utils/ensureSyncSchema.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

// 捕获未处理的异常
process.on('uncaughtException', (err) => {
  console.error('[FATAL] 未捕获的异常:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WARN] 未处理的 Promise 拒绝:', reason);
});

// 可控的自动建表（默认关闭：AUTO_MIGRATE_SYNC_SCHEMA=1 才启用）
ensureSyncSchema();

const server = app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});

// 确保服务器保持运行
server.on('error', (err) => {
  console.error('[SERVER] 服务器错误:', err);
});

// 保持进程活跃
server.keepAliveTimeout = 65000;
