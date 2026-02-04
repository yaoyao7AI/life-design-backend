# 🚨 线上登录问题诊断

## ❌ 问题描述

**线上地址：** `https://www.life-design.me/me`  
**错误信息：** `Failed to fetch`  
**测试地址：** `http://localhost:5173/me` ✅ 正常

---

## 🔍 问题分析

### 可能的原因

1. **前端 API 地址配置错误**
   - 前端可能仍在使用 `localhost:3000` 或错误的 API 地址
   - 生产环境需要使用实际的 API 地址

2. **CORS 配置问题**
   - 后端可能没有允许 `https://www.life-design.me` 的跨域请求

3. **HTTPS/HTTP 混合内容问题**
   - 前端是 HTTPS，但 API 地址可能是 HTTP
   - 浏览器会阻止混合内容

4. **DNS 解析问题**
   - API 域名可能未正确解析

---

## ✅ 解决方案

### 方案 1：检查前端环境变量配置

**文件位置：** `frontend/.env.production` 或 Vercel 环境变量

**需要配置：**

**选项 A：使用子域名（推荐）**
```env
VITE_API_BASE_URL=https://api.life-design.me/api
```

**选项 B：使用完整 IP 地址**
```env
VITE_API_BASE_URL=http://123.56.17.118:3000/api
```

**选项 C：使用代理路径（如果 Vercel 配置了代理）**
```env
VITE_API_BASE_URL=/api
```

---

### 方案 2：检查后端 CORS 配置

**文件：** `src/app.js`

**需要确保包含：**
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://life-design.me',      // ✅ 主域名
  'https://www.life-design.me',   // ✅ www 子域名
];
```

**检查当前配置：**
- 确认 `https://www.life-design.me` 在允许列表中
- 确认 CORS 配置正确

---

### 方案 3：使用 HTTPS API（推荐）

**如果后端支持 HTTPS：**
- 配置 SSL 证书
- 使用 `https://api.life-design.me` 作为 API 地址

**如果后端不支持 HTTPS：**
- 使用 Nginx 反向代理配置 HTTPS
- 或使用 Cloudflare 等 CDN 提供 HTTPS

---

### 方案 4：检查浏览器控制台错误

**打开浏览器开发者工具（F12）：**
1. 切换到 **Console** 标签
2. 查看具体错误信息
3. 切换到 **Network** 标签
4. 查看失败的请求详情

**常见错误：**
- `CORS policy: No 'Access-Control-Allow-Origin'` → CORS 问题
- `Mixed Content` → HTTPS/HTTP 混合内容问题
- `Failed to fetch` → 网络请求失败

---

## 🔧 快速修复步骤

### 步骤 1：检查前端环境变量

**在 Vercel Dashboard：**
1. 进入项目 → **Settings** → **Environment Variables**
2. 检查 `VITE_API_BASE_URL` 的值
3. 确认是生产环境的正确地址

**应该配置为：**
```env
VITE_API_BASE_URL=https://api.life-design.me/api
```

**或者：**
```env
VITE_API_BASE_URL=http://123.56.17.118:3000/api
```

---

### 步骤 2：更新后端 CORS 配置

**文件：** `src/app.js`

**确保包含：**
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://life-design.me',
  'https://www.life-design.me',  // ✅ 确保包含这个
];
```

**然后重启后端：**
```bash
pm2 restart life-design-backend
```

---

### 步骤 3：验证配置

**测试 API 访问：**
```bash
# 测试后端 API（从线上前端访问）
curl -X POST https://api.life-design.me/api/auth/send-code \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.life-design.me" \
  -d '{"phone":"18210827464"}'

# 或使用 IP 地址
curl -X POST http://123.56.17.118:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -H "Origin: https://www.life-design.me" \
  -d '{"phone":"18210827464"}'
```

---

## 📋 检查清单

### 前端配置

- [ ] Vercel 环境变量 `VITE_API_BASE_URL` 已配置
- [ ] 环境变量值是生产环境的正确地址
- [ ] 前端代码使用 `import.meta.env.VITE_API_BASE_URL`
- [ ] 前端已重新部署（如果修改了环境变量）

### 后端配置

- [ ] CORS 配置包含 `https://www.life-design.me`
- [ ] CORS 配置包含 `https://life-design.me`
- [ ] 后端服务器已重启
- [ ] API 地址可以正常访问

### DNS 配置

- [ ] `api.life-design.me` A 记录指向 `123.56.17.118`
- [ ] DNS 解析正常

---

## 🧪 测试步骤

### 1. 检查浏览器控制台

**打开 `https://www.life-design.me/me`：**
1. 按 F12 打开开发者工具
2. 切换到 **Console** 标签
3. 查看错误信息
4. 切换到 **Network** 标签
5. 查看失败的请求

---

### 2. 测试 API 请求

**在浏览器控制台执行：**
```javascript
// 测试 API 地址
fetch('https://api.life-design.me/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// 或使用 IP 地址
fetch('http://123.56.17.118:3000/api/health')
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

---

### 3. 检查 CORS 响应头

**使用 curl 测试：**
```bash
curl -X OPTIONS https://api.life-design.me/api/auth/send-code \
  -H "Origin: https://www.life-design.me" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**应该看到：**
```
Access-Control-Allow-Origin: https://www.life-design.me
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
```

---

## 🎯 推荐配置

### 前端环境变量（Vercel）

```env
VITE_API_BASE_URL=https://api.life-design.me/api
```

### 后端 CORS 配置

```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://life-design.me',
  'https://www.life-design.me',
];
```

### DNS 配置

```
api.life-design.me → 123.56.17.118 (A 记录)
```

---

## 📝 总结

**问题：** 线上地址无法登录，显示 "Failed to fetch"

**可能原因：**
1. 前端 API 地址配置错误
2. CORS 配置不包含 `https://www.life-design.me`
3. HTTPS/HTTP 混合内容问题

**解决步骤：**
1. ✅ 检查并更新 Vercel 环境变量
2. ✅ 更新后端 CORS 配置
3. ✅ 重启后端服务器
4. ✅ 重新部署前端（如果修改了环境变量）
5. ✅ 测试访问

---

## 🆘 需要帮助？

如果问题仍然存在，请提供：
1. 浏览器控制台的完整错误信息
2. Network 标签中失败请求的详情
3. Vercel 环境变量配置截图
4. 后端 CORS 配置代码



