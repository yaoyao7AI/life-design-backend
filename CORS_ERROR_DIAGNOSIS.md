# 🔍 CORS 错误原因分析

## ⚠️ 发现的问题

### 问题 1：URL 显示异常（Punycode 编码）

**错误 URL：** `http://xn--ip-0p3cl7jf7fo83a16x:3000/api/auth/send-code`

**原因：**
- 前端环境变量 `.env.local` 中还是占位符：`你的服务器IP`
- 浏览器将中文字符编码成了 Punycode：`xn--ip-0p3cl7jf7fo83a16x`
- 这个域名不在后端 CORS 允许列表中

### 问题 2：CORS 预检请求失败

**错误信息：**
```
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**原因：**
- 前端请求的域名 `xn--ip-0p3cl7jf7fo83a16x` 不在后端 CORS 允许列表中
- 后端只允许 `localhost:5173` 等本地域名

---

## ✅ 后端 CORS 配置状态

**当前配置（正确）：**
```javascript
origin: [
  'http://localhost:5173',      // ✅ 允许
  'http://127.0.0.1:5173',       // ✅ 允许
  'http://localhost:3000',       // ✅ 允许
  'http://localhost:5174',       // ✅ 允许
]
```

**测试结果：**
- ✅ 预检请求（OPTIONS）返回正确的 CORS 头
- ✅ `Access-Control-Allow-Origin: http://localhost:5173` ✅
- ✅ `Access-Control-Allow-Credentials: true` ✅
- ✅ `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH` ✅

---

## 🔧 解决方案

### 步骤 1：修复前端环境变量（必须）

**文件位置：** `frontend/.env.local`

**当前（错误）：**
```env
VITE_API_BASE_URL=http://你的服务器IP:3000/api
```

**应该改为（本地开发）：**
```env
VITE_API_BASE_URL=http://localhost:3000/api
```

**或者（生产环境）：**
```env
VITE_API_BASE_URL=http://123.56.17.118:3000/api
```
⚠️ 将 `123.56.17.118` 替换为你的实际服务器 IP

### 步骤 2：重启前端服务器

```bash
cd frontend
# 按 Ctrl+C 停止当前服务器
npm run dev
```

### 步骤 3：清除浏览器缓存

- 按 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（Mac）强制刷新
- 或使用无痕模式测试

---

## 🧪 验证修复

### 1. 检查环境变量

```bash
cd frontend
cat .env.local
```

应该看到：
```
VITE_API_BASE_URL=http://localhost:3000/api
```

**不应该看到：**
```
VITE_API_BASE_URL=http://你的服务器IP:3000/api
```

### 2. 检查网络请求

打开浏览器开发者工具（F12）→ Network 标签

**正确的请求 URL：**
```
http://localhost:3000/api/auth/send-code
```

**错误的请求 URL（当前）：**
```
http://xn--ip-0p3cl7jf7fo83a16x:3000/api/auth/send-code
```

### 3. 检查 CORS 响应头

请求成功后，响应头应该包含：
```
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
```

---

## 📋 问题总结

| 问题 | 原因 | 解决方法 |
|------|------|----------|
| URL 显示为 Punycode | 环境变量是占位符 | 更新 `.env.local` 文件 |
| CORS 错误 | 请求域名不在允许列表 | 修复环境变量后自动解决 |
| 预检请求失败 | 同上 | 同上 |

---

## ✅ 修复检查清单

- [ ] 更新 `frontend/.env.local` 文件
- [ ] 将 `你的服务器IP` 替换为 `localhost`（本地）或实际 IP（生产）
- [ ] 重启前端服务器
- [ ] 清除浏览器缓存
- [ ] 测试登录功能
- [ ] 检查网络请求 URL 是否正确
- [ ] 确认不再有 CORS 错误

---

## 🎯 根本原因

**核心问题：** 前端环境变量配置错误

**影响：**
1. URL 被编码成 Punycode
2. 请求域名不在 CORS 允许列表
3. 浏览器阻止跨域请求

**解决：** 更新环境变量 → 重启前端 → 清除缓存

---

修复环境变量后，CORS 错误会自动消失！🚀



