# 🔧 生产环境登录错误修复

## ⚠️ 错误分析

### 错误 1：405 Method Not Allowed
**URL：** `/api/proxy/auth/send-code`

**原因：**
- 前端请求路径：`/api/proxy/auth/send-code`
- 后端实际路径：`/api/auth/send-code`
- 路径不匹配导致 405 错误

### 错误 2：404 Not Found
**URL：** `me:1`

**原因：**
- 可能是前端路由配置问题
- 或者 API 路径配置错误

### 错误 3：JSON 解析错误
**错误：** `Failed to execute 'json' on 'Response': Unexpected end of JSON input`

**原因：**
- 服务器返回了非 JSON 响应（可能是 HTML 错误页面）
- 或者响应为空

---

## ✅ 已修复的问题

### 1. CORS 配置更新

**文件：** `src/app.js`

**更新内容：**
- ✅ 添加生产域名 `https://life-design.me` 到允许列表
- ✅ 支持动态 origin 检查
- ✅ 开发环境允许所有来源
- ✅ 生产环境允许指定域名

---

## 🔧 需要检查的前端配置

### 1. API 基础路径配置

**问题：** 前端请求 `/api/proxy/auth/send-code`，但后端是 `/api/auth/send-code`

**解决方案：**

**选项 A：修改前端 API 路径（推荐）**

前端 `.env.production` 或 `.env`：
```env
VITE_API_BASE_URL=https://your-backend-domain.com/api
# 或
VITE_API_BASE_URL=http://123.56.17.118:3000/api
```

前端 API 调用：
```javascript
// 正确
fetch(`${API_BASE_URL}/auth/send-code`, ...)

// 错误（不要加 /proxy）
fetch(`${API_BASE_URL}/proxy/auth/send-code`, ...)
```

**选项 B：后端添加代理路由（不推荐）**

如果需要保持前端路径不变，可以在后端添加代理路由：
```javascript
// 在 app.js 中添加
app.use("/api/proxy", (req, res, next) => {
  req.url = req.url.replace("/proxy", "");
  next();
});
app.use("/api", authRouter);
```

---

## 🧪 测试生产环境 API

### 1. 测试 CORS 预检请求

```bash
curl -X OPTIONS http://123.56.17.118:3000/api/auth/send-code \
  -H "Origin: https://life-design.me" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**应该看到：**
```
Access-Control-Allow-Origin: https://life-design.me
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
```

### 2. 测试实际请求

```bash
curl -X POST http://123.56.17.118:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -H "Origin: https://life-design.me" \
  -d '{"phone":"17609285149"}'
```

---

## 📋 修复检查清单

### 后端检查

- [x] CORS 配置已更新（添加生产域名）
- [x] `/api/auth/send-code` 路由正常
- [x] 服务正常运行
- [ ] 如果需要，添加 `/api/proxy` 代理路由

### 前端检查

- [ ] API 基础路径配置正确
- [ ] 请求路径正确（不要有 `/proxy`）
- [ ] 环境变量配置正确
- [ ] 生产环境构建配置正确

---

## 🚀 部署步骤

### 1. 更新后端 CORS 配置

```bash
# 上传更新后的 app.js
scp src/app.js root@123.56.17.118:/root/apps/life-design-backend/src/

# 重启服务
ssh root@123.56.17.118 "pm2 restart life-design-backend"
```

### 2. 检查前端配置

**确保前端 API 路径正确：**
- 不要使用 `/api/proxy/auth/send-code`
- 应该使用 `/api/auth/send-code`

**前端环境变量：**
```env
# 生产环境
VITE_API_BASE_URL=http://123.56.17.118:3000/api
# 或
VITE_API_BASE_URL=https://your-backend-domain.com/api
```

---

## 🎯 常见问题

### Q: 为什么前端请求 `/api/proxy/auth/send-code`？

**A:** 可能是：
1. 前端配置了代理路径
2. Vite 配置了 proxy
3. 前端 API 路径配置错误

**解决：** 检查前端 `vite.config.js` 或 API 配置文件

### Q: 如何添加代理路由？

**A:** 如果必须保持前端路径不变，可以在后端添加：

```javascript
// 在 app.js 中，路由注册之前添加
app.use("/api/proxy", (req, res, next) => {
  // 移除 /proxy 前缀
  req.url = req.url.replace("/proxy", "");
  next();
});
```

---

## ✅ 完成状态

**后端 CORS 配置已更新，支持生产域名！**

**下一步：**
1. 检查前端 API 路径配置
2. 确保前端不使用 `/proxy` 路径
3. 测试生产环境登录功能

**修复完成后，生产环境登录应该可以正常工作！** 🚀



