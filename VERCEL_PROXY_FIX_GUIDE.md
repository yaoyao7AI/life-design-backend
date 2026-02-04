# 🔧 Vercel 代理 405 错误修复指南

## 🚨 问题确认

**错误信息：**
```
POST https://www.life-design.me/api/proxy/auth/send-code 405 (Method Not Allowed)
```

**问题分析：**
- ✅ 前端已使用代理路径：`/api/proxy/auth/send-code`
- ✅ 后端路由正常（直接测试返回 200）
- ❌ Vercel 代理函数返回 405

---

## ✅ 解决方案

### 方案 1：检查并修复 Vercel 代理函数

#### 步骤 1：确认文件存在

**文件路径：** `frontend/api/proxy/[...path].ts`

**检查文件：**
```bash
cd frontend
ls -la api/proxy/[...path].ts
```

**如果文件不存在：**
- 创建目录：`mkdir -p api/proxy`
- 创建文件：`api/proxy/[...path].ts`

---

#### 步骤 2：确认代码正确

**文件内容：** `frontend/api/proxy/[...path].ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

const BACKEND_URL = 'http://123.56.17.118:3000';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 设置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 获取路径参数
    // 请求 /api/proxy/auth/send-code 时，req.query.path 应该是 ['auth', 'send-code']
    const path = Array.isArray(req.query.path) 
      ? req.query.path.join('/') 
      : req.query.path || '';
    
    // 构建后端 URL
    const url = `${BACKEND_URL}/api/${path}`;
    
    console.log('[Vercel Proxy]', req.method, url);
    
    // 准备请求体
    let body: string | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = JSON.stringify(req.body || {});
    }
    
    // 转发请求到后端
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: body,
    });

    const data = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(data);
  } catch (error: any) {
    console.error('[Vercel Proxy Error]', error);
    res.status(500).json({ error: error.message });
  }
}
```

**关键点：**
- ✅ 使用 `[...path].ts`（三个点，捕获所有路径）
- ✅ 正确处理 `req.query.path`（数组）
- ✅ 正确处理 POST 请求的 body
- ✅ 设置正确的 CORS 头

---

#### 步骤 3：安装依赖（如果需要）

**如果 TypeScript 报错：**
```bash
cd frontend
npm install --save-dev @vercel/node
```

---

#### 步骤 4：提交并部署

```bash
cd frontend
git add api/proxy/[...path].ts
git commit -m "Fix: Update Vercel proxy function to handle POST requests"
git push origin main
```

**Vercel 会自动部署**

---

### 方案 2：检查 Vercel 部署日志

**在 Vercel Dashboard：**
1. 进入项目 → **Deployments**
2. 点击最新部署
3. 查看 **Build Logs**
4. 查找代理函数相关的错误或警告

**常见错误：**
- 文件路径错误
- 代码语法错误
- 缺少依赖

---

### 方案 3：使用 Vercel.json 配置（备选）

**如果代理函数不工作，可以使用 `vercel.json`：**

**创建文件：** `frontend/vercel.json`

```json
{
  "rewrites": [
    {
      "source": "/api/proxy/:path*",
      "destination": "http://123.56.17.118:3000/api/:path*"
    }
  ]
}
```

**注意：** 这种方式可能不支持 HTTPS，建议使用代理函数。

---

## 🧪 测试步骤

### 测试 1：检查代理函数是否部署

**在浏览器控制台（F12 → Console）执行：**

```javascript
// 测试代理函数是否存在
fetch('/api/proxy/health')
  .then(r => r.json())
  .then(data => {
    console.log('✅ 代理函数正常:', data);
  })
  .catch(err => {
    console.error('❌ 代理函数失败:', err);
    console.log('可能原因：');
    console.log('1. 代理函数未部署');
    console.log('2. 路径解析错误');
    console.log('3. 后端服务器未运行');
  });
```

---

### 测试 2：测试 POST 请求

**在浏览器控制台执行：**

```javascript
// 测试 POST 请求
fetch('/api/proxy/auth/send-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '18210827464' })
})
  .then(r => r.json())
  .then(data => {
    console.log('✅ POST 请求成功:', data);
  })
  .catch(err => {
    console.error('❌ POST 请求失败:', err);
  });
```

---

## 🔍 问题排查

### 如果仍然返回 405

**检查 1：确认文件路径**
```bash
cd frontend
ls -la api/proxy/
# 应该看到：[...path].ts
```

**检查 2：确认文件命名**
- ✅ 正确：`[...path].ts`（三个点）
- ❌ 错误：`[path].ts`（一个点）
- ❌ 错误：`path.ts`

**检查 3：确认代码正确**
- ✅ 导入了 `@vercel/node`
- ✅ 正确处理了 `req.query.path`
- ✅ 正确处理了 POST 请求

**检查 4：查看 Vercel 部署日志**
- 进入 Vercel Dashboard → Deployments → Build Logs
- 查找错误信息

---

## 📋 修复检查清单

### 代理函数文件

- [ ] 文件存在：`frontend/api/proxy/[...path].ts`
- [ ] 文件命名正确：`[...path].ts`（三个点）
- [ ] 代码正确：正确处理 POST 请求
- [ ] 路径解析正确：`req.query.path` 处理正确
- [ ] 安装了依赖：`@vercel/node`（如果需要）

### Vercel 部署

- [ ] 代码已提交到 Git
- [ ] 代码已推送到 GitHub
- [ ] Vercel 已部署
- [ ] 部署日志没有错误
- [ ] 部署状态为 "Ready"

### 测试

- [ ] 清除浏览器缓存
- [ ] 测试 GET 请求：`fetch('/api/proxy/health')`
- [ ] 测试 POST 请求：`fetch('/api/proxy/auth/send-code', {...})`
- [ ] 确认不再返回 405 错误

---

## 🎯 预期结果

修复后应该：
- ✅ 不再返回 405 错误
- ✅ POST 请求正常工作
- ✅ 可以发送验证码
- ✅ 登录功能正常

---

## 📝 总结

**问题：** Vercel 代理函数返回 405 错误

**解决方案：**
1. ✅ 检查代理函数文件是否存在
2. ✅ 检查代理函数代码是否正确
3. ✅ 检查 Vercel 部署日志
4. ✅ 重新部署（如果需要）

**如果问题仍然存在，请提供：**
1. Vercel 部署日志（Build Logs）
2. 代理函数文件内容
3. 浏览器控制台的完整错误信息



