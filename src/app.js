import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import affirmationsRouter from "./routes/affirmations.js";
import authRouter from "./routes/auth.js";
import favoritesRouter from "./routes/favorites.js";
import visionRouter from "./routes/vision.js";
import uploadRouter from "./routes/upload.js";
import adminRouter from "./routes/admin.js";
import todosRouter from "./routes/todos.js";
import longTermPlansRouter from "./routes/longTermPlans.js";
import weeklyReportsRouter from "./routes/weeklyReports.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCorsOrigins(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const isProduction = process.env.NODE_ENV === "production";

// 位于 Nginx 等反向代理之后时，使 req.protocol / req.hostname 反映 X-Forwarded-*（上传返回的 URL 等）
if (isProduction) {
  app.set("trust proxy", 1);
}

const corsOriginsFromEnv = parseCorsOrigins(process.env.CORS_ORIGINS);
const defaultProdOrigins = [
  "https://life-design.me",
  "https://www.life-design.me",
];
const allowedOrigins = isProduction
  ? (corsOriginsFromEnv.length > 0 ? corsOriginsFromEnv : defaultProdOrigins)
  : [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      ...defaultProdOrigins,
    ];

// CORS 配置 - 生产环境默认只允许指定域名
app.use(
  cors({
    origin: function (origin, callback) {
      // 无 origin：curl / Postman / 同源请求等，允许
      if (!origin) return callback(null, true);

      // 开发环境：放开（避免本地调试频繁改配置）
      if (!isProduction) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 不抛错（避免变成 500），仅不返回 CORS 头，让浏览器自行拦截
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const apiDiagnosticsEnabled =
  ["1", "true", "yes", "on"].includes(
    String(process.env.API_DIAGNOSTICS_LOG_ENABLED || "").trim().toLowerCase()
  );

if (apiDiagnosticsEnabled) {
  app.use((req, res, next) => {
    const reqId =
      req.headers["x-request-id"] ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    res.setHeader("X-Request-Id", reqId);
    const startedAt = Date.now();

    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      const elapsedMs = Date.now() - startedAt;
      const contentType = res.getHeader("content-type") || null;
      console.log(
        `[API_DIAG] request_id=${reqId} method=${req.method} path=${req.originalUrl} status=${res.statusCode} content_type=${contentType} elapsed_ms=${elapsedMs}`
      );
    });

    next();
  });
}

// 静态文件服务 - 提供上传文件的访问
const uploadsDir = path.join(__dirname, "../uploads");
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (err) {
  console.error("[uploads] 无法创建 uploads 目录:", err?.message || err);
}
app.use("/uploads", express.static(uploadsDir));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/affirmations", affirmationsRouter);
app.use("/api/auth", authRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/vision", visionRouter);
app.use("/api/upload", uploadRouter);
app.use("/upload", uploadRouter);
app.use("/api/todos", todosRouter);
app.use("/api/plans/long-term", longTermPlansRouter);
app.use("/api/weekly-reports", weeklyReportsRouter);
app.use("/admin", adminRouter);

// 代理路由支持（兼容前端 /api/proxy 路径）
// 必须在标准路由之后注册，这样 /api/proxy 路径会转发到对应的路由
app.use("/api/proxy/affirmations", affirmationsRouter);
app.use("/api/proxy/auth", authRouter);
app.use("/api/proxy/favorites", favoritesRouter);
app.use("/api/proxy/vision", visionRouter);
app.use("/api/proxy/upload", uploadRouter);
app.use("/api/proxy/todos", todosRouter);
app.use("/api/proxy/plans/long-term", longTermPlansRouter);
app.use("/api/proxy/weekly-reports", weeklyReportsRouter);

// 404 处理 - 确保返回 JSON 格式
app.use((req, res, next) => {
  // 检查是否是 API 请求
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ 
      error: "路由不存在", 
      path: req.path,
      method: req.method
    });
  }
  // 非 API 请求返回 404
  res.status(404).json({ error: "页面不存在" });
});

// 全局错误处理 - 确保所有错误都返回 JSON 格式
app.use((err, req, res, next) => {
  console.error("[服务器错误]", err);
  
  // 确保响应头已设置
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      error: err.message || "服务器内部错误",
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
});

export default app;
