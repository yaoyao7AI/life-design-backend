# 🔧 Vercel 日志为空 - 根本原因修复

## 🚨 问题诊断

**现象：**
- ✅ 代理函数文件存在：`frontend/api/proxy/[...path].ts`
- ✅ 代理函数代码正确（包含大量 console.log）
- ❌ Vercel 运行时日志为空
- ❌ 前端请求返回 404 错误

**根本原因：**
`vercel.json` 的 `rewrites` 配置错误，导致**所有请求**（包括 `/api/proxy/*`）都被重写到 `/index.html`，代理函数**根本没有被调用**。

---

## ✅ 解决方案

### 修复 vercel.json

**错误的配置：**
```json
{
  "rewrites": [
    {
      "source": "/(.*)",  // ❌ 匹配所有路径，包括 /api/proxy/*
      "destination": "/index.html"
    }
  ]
}
```

**正确的配置：**
```json
{
  "rewrites": [
    {
      "source": "/((?!api/).*)",  // ✅ 排除 /api/ 开头的路径
      "destination": "/index.html"
    }
  ]
}
```

**关键点：**
- `(?!api/)` 是**负向前瞻断言**，排除以 `api/` 开头的路径
- 这样 `/api/proxy/*` 请求不会被重写，Vercel 可以正确识别并调用 serverless function

---

## 📋 修复步骤

### 步骤 1：确认文件已修复

**文件：** `frontend/vercel.json`

**确认内容：**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

---

### 步骤 2：提交并推送代码

```bash
cd /Users/mac/Desktop/affirmation-mvp/frontend

# 检查修改
git status

# 添加修改
git add vercel.json

# 提交
git commit -m "Fix: Exclude /api/ paths from rewrites to allow serverless functions"

# 推送
git push origin main
```

---

### 步骤 3：等待 Vercel 自动部署

1. **Vercel 会自动检测到推送并开始部署**
2. **查看部署状态：**
   - 进入 Vercel Dashboard → 项目 → Deployments
   - 等待部署完成（状态变为 "Ready"）

---

### 步骤 4：验证修复

#### 验证 1：检查 Build Logs

**在 Vercel Dashboard：**
1. 进入最新部署 → **Build Logs**
2. 查找 "Functions" 相关信息

**应该看到：**
```
Functions:
  api/proxy/[...path].ts
```

---

#### 验证 2：测试代理函数

**在浏览器控制台（F12 → Console）执行：**

```javascript
// 测试代理函数
fetch('/api/proxy/auth/send-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '18210827464' })
})
  .then(r => r.json())
  .then(data => {
    console.log('✅ 代理函数正常:', data);
  })
  .catch(err => {
    console.error('❌ 代理函数失败:', err);
  });
```

**预期结果：**
- ✅ 不再返回 404 错误
- ✅ 返回后端 API 的响应（成功或错误）

---

#### 验证 3：检查 Vercel 运行时日志

**在 Vercel Dashboard：**
1. 进入项目 → **Logs**
2. 点击 "Live" 切换（开启实时日志）
3. 在前端页面点击 "获取验证码"
4. **应该看到日志输出：**

```
[Proxy] Function called: { method: 'POST', url: '/api/proxy/auth/send-code', ... }
[Proxy] Incoming request: { method: 'POST', ... }
[Proxy] Request: { method: 'POST', ... }
[Proxy] POST http://123.56.17.118:3000/api/auth/send-code
[Proxy] Response status: 200
```

**如果看到这些日志：**
- ✅ 代理函数正常工作
- ✅ 请求被正确转发到后端
- ✅ 问题已解决

---

## 🔍 问题排查

### 如果仍然没有日志

**检查 1：确认 vercel.json 已提交**
```bash
cd frontend
git log --oneline -1
# 应该看到最新的 commit 包含 vercel.json 的修改
```

**检查 2：确认 Vercel 部署成功**
- 进入 Vercel Dashboard → Deployments
- 确认最新部署状态为 "Ready"
- 确认 Build Logs 没有错误

**检查 3：清除浏览器缓存**
- 硬刷新：`Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows)
- 或使用无痕模式测试

**检查 4：确认代理函数文件存在**
```bash
cd frontend
ls -la api/proxy/[...path].ts
# 应该看到文件存在
```

---

### 如果代理函数返回 500

**可能原因：**
1. 后端服务器未运行
2. 后端地址错误
3. 网络连接问题

**排查步骤：**
```bash
# 检查后端服务器
ssh user@123.56.17.118
pm2 list

# 测试后端连接
curl http://123.56.17.118:3000/api/health
```

---

## 📝 技术说明

### Vercel Serverless Functions 工作原理

1. **文件识别：**
   - Vercel 自动识别 `api/` 目录下的文件作为 serverless functions
   - `api/proxy/[...path].ts` 会被识别为动态路由函数

2. **路由匹配：**
   - 请求 `/api/proxy/auth/send-code` 会匹配到 `api/proxy/[...path].ts`
   - `req.query.path` 会是 `['auth', 'send-code']`

3. **rewrites 优先级：**
   - `rewrites` 规则在 serverless functions **之前**执行
   - 如果 `rewrites` 匹配了请求，函数**不会被调用**
   - 因此必须排除 `/api/` 路径

---

## 🎯 预期结果

修复后应该：
- ✅ Vercel 运行时日志有输出
- ✅ 代理函数正常工作
- ✅ POST 请求正常转发
- ✅ 可以发送验证码
- ✅ 登录功能正常

---

## 📋 修复检查清单

### vercel.json 配置
- [x] 文件已修复：使用 `(?!api/)` 排除 `/api/` 路径
- [ ] 代码已提交到 Git
- [ ] 代码已推送到 GitHub
- [ ] Vercel 已部署

### Vercel 部署
- [ ] 部署状态为 "Ready"
- [ ] Build Logs 显示 Functions 已部署
- [ ] 没有构建错误

### 测试验证
- [ ] 清除浏览器缓存
- [ ] 测试代理函数：`fetch('/api/proxy/auth/send-code', ...)`
- [ ] 检查 Vercel 运行时日志有输出
- [ ] 确认不再返回 404 错误
- [ ] 确认可以发送验证码

---

## 🚀 下一步

1. **提交并推送代码**
2. **等待 Vercel 自动部署**
3. **测试代理函数**
4. **检查 Vercel 日志**

如果问题仍然存在，请提供：
1. Vercel 部署日志（Build Logs）
2. Vercel 运行时日志（Logs）
3. 浏览器控制台的完整错误信息



