# 🔧 CORS 错误修复指南

## ✅ 已修复的问题

### 1. CORS 配置已更新

**文件：** `src/app.js`

**修复内容：**
- ✅ 配置了明确的允许来源（origin）
- ✅ 启用了 credentials 支持
- ✅ 配置了允许的 HTTP 方法
- ✅ 配置了允许的请求头
- ✅ 支持预检请求（OPTIONS）

---

## 📋 CORS 配置详情

### 当前配置

```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',      // Vite 开发服务器
    'http://127.0.0.1:5173',       // 本地访问
    'http://localhost:3000',       // 本地后端
    'http://localhost:5174',       // 其他可能的端口
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
```

---

## 🚀 生产环境配置

### 如果需要添加生产环境域名

在生产环境部署时，需要添加实际的前端域名：

```javascript
app.use(cors({
  origin: [
    'http://localhost:5173',           // 开发环境
    'http://127.0.0.1:5173',           // 本地访问
    'https://your-frontend-domain.com', // 生产环境前端域名
    'https://www.your-frontend-domain.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
```

### 或者使用环境变量动态配置

```javascript
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

app.use(cors({
  origin: (origin, callback) => {
    // 允许没有 origin 的请求（如移动应用、Postman）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
```

然后在 `.env` 文件中添加：
```env
ALLOWED_ORIGINS=http://localhost:5173,https://your-domain.com
```

---

## 🧪 验证修复

### 1. 重启后端服务器

```bash
# 如果使用 PM2
pm2 restart life-design-backend

# 如果直接运行
npm run dev
```

### 2. 检查 CORS 响应头

使用 curl 测试：

```bash
curl -X OPTIONS http://localhost:3000/api/auth/send-code \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

应该看到以下响应头：
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
Access-Control-Allow-Credentials: true
```

### 3. 浏览器测试

1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签
3. 尝试发送请求
4. 检查响应头，应该包含 `Access-Control-Allow-Origin`
5. 不应该再看到 CORS 错误

---

## ⚠️ 常见问题

### 问题 1：仍然看到 CORS 错误

**可能原因：**
- 服务器未重启
- 前端使用的端口不在允许列表中
- 浏览器缓存了旧的响应

**解决方法：**
1. 确认服务器已重启
2. 检查前端运行端口是否在 `origin` 列表中
3. 清除浏览器缓存或使用无痕模式

### 问题 2：预检请求失败

**可能原因：**
- OPTIONS 方法未正确处理
- 请求头不在允许列表中

**解决方法：**
- 确保 `methods` 包含 `OPTIONS`
- 确保 `allowedHeaders` 包含所有需要的请求头

### 问题 3：凭证（credentials）未发送

**可能原因：**
- 前端未设置 `credentials: 'include'`

**前端需要配置：**
```javascript
fetch('http://localhost:3000/api/auth/send-code', {
  method: 'POST',
  credentials: 'include', // 重要！
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ phone: '18210827464' })
});
```

---

## 📝 注意事项

1. **开发环境：** 当前配置允许所有常见的本地开发端口
2. **生产环境：** 需要明确指定允许的前端域名
3. **安全性：** 不要使用 `origin: '*'` 在生产环境，这会允许任何域名访问
4. **凭证：** `credentials: true` 允许发送 cookies 和认证信息

---

## ✅ 修复完成

CORS 配置已更新，现在应该可以正常处理跨域请求了！

如果仍有问题，请检查：
1. 服务器是否已重启
2. 前端端口是否在允许列表中
3. 浏览器控制台的详细错误信息



