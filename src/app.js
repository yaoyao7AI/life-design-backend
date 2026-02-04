import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import affirmationsRouter from "./routes/affirmations.js";
import authRouter from "./routes/auth.js";
import favoritesRouter from "./routes/favorites.js";
import visionRouter from "./routes/vision.js";
import uploadRouter from "./routes/upload.js";
import adminRouter from "./routes/admin.js";
import todosRouter from "./routes/todos.js";
import longTermPlansRouter from "./routes/longTermPlans.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS 配置 - 允许前端访问
app.use(cors({
  origin: function (origin, callback) {
    // 允许的来源列表
    const allowedOrigins = [
      'http://localhost:5173',      // Vite 开发服务器
      'http://localhost:5174',       // 其他开发端口
      'http://127.0.0.1:5173',       // 本地访问
      'https://life-design.me',      // 生产环境域名
      'https://www.life-design.me',  // www 子域名（生产环境）
      'http://life-design.me',       // HTTP 生产环境（如果有）
      'http://www.life-design.me',   // HTTP www 子域名（如果有）
    ];
    
    // 开发环境或无 origin（如 Postman）允许所有来源
    if (!origin || process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // 生产环境允许所有来源（临时，建议改为只允许指定域名）
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

app.use(express.json());

// 静态文件服务 - 提供上传文件的访问
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/affirmations", affirmationsRouter);
app.use("/api/auth", authRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/vision", visionRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/todos", todosRouter);
app.use("/api/plans/long-term", longTermPlansRouter);
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
