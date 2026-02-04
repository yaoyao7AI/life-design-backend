# 🔧 Vercel 代理 404 错误修复

## 🚨 问题

**错误信息：**
```
POST https://life-design-hu7tp5rrz-yaoyao7ais-projects.vercel.app/api/proxy/auth/send-code 404 (Not Found)
```

**页面错误：**
```
The page could not be found NOT_FOUND
```

**问题分析：**
- ✅ 前端已使用代理路径：`/api/proxy/auth/send-code`
- ✅ `vercel.json` 已修复（排除 `api/` 路径）
- ❌ Vercel 返回 404，说明代理函数不存在或路径不匹配

---

## ✅ 解决方案

### 方案 1：创建 Vercel 代理函数（必须）

#### 步骤 1：确认文件结构

**文件路径：** `frontend/api/proxy/[...path].ts`

**目录结构：**
```
frontend/
  └── api/
      └── proxy/
          └── [...path].ts  ← 这个文件必须存在
```

**检查文件是否存在：**
```bash
cd frontend
ls -la api/proxy/[...path].ts
```

**如果文件不存在：**
- 创建目录：`mkdir -p api/proxy`
- 创建文件：`api/proxy/[...path].ts`

---

#### 步骤 2：创建代理函数文件

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
    // 请求 /api/proxy/auth/send-code 时
    // req.query.path 应该是 ['auth', 'send-code']
    const path = Array.isArray(req.query.path) 
      ? req.query.path.join('/') 
      : req.query.path || '';
    
    // 构建后端 URL
    const url = `${BACKEND_URL}/api/${path}`;
    
    console.log('[Vercel Proxy]', req.method, url);
    
    // 准备请求头
    const headers: Record<string, string> = {
      'Content-Type': req.headers['content-type'] || 'application/json',
    };
    
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    // 准备请求体
    let body: string | undefined = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = JSON.stringify(req.body || {});
    }
    
    // 转发请求到后端
    const response = await fetch(url, {
      method: req.method,
      headers: headers,
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
- ✅ 文件路径：`frontend/api/proxy/[...path].ts`
- ✅ 文件命名：`[...path].ts`（三个点，捕获所有路径）
- ✅ 正确处理 `req.query.path`（数组）
- ✅ 正确处理 POST 请求的 body

---

#### 步骤 3：安装依赖（如果需要）

**如果 TypeScript 报错：**
```bash
cd frontend
npm install --save-dev @vercel/node
```

---

#### 步骤 4：确认 vercel.json 配置

**文件：** `frontend/vercel.json`

**应该配置为：**
```json
{
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ]
}
```

**确认：**
- ✅ 使用负向前瞻断言：`(?!api/)`
- ✅ 排除 `api/` 开头的路径
- ✅ 代理函数可以正常工作

---

#### 步骤 5：提交并部署

```bash
cd frontend

# 添加文件
git add api/proxy/[...path].ts
git add vercel.json

# 提交
git commit -m "Fix: Add Vercel proxy function for API requests"

# 推送
git push origin main
```

**Vercel 会自动部署**

---

## 🧪 验证步骤

### 步骤 1：检查文件是否存在

**在本地检查：**
```bash
cd frontend
ls -la api/proxy/[...path].ts
```

**应该看到文件存在**

---

### 步骤 2：检查 Vercel 部署日志

**在 Vercel Dashboard：**
1. 进入项目 → **Deployments**
2. 点击最新部署
3. 查看 **Build Logs**
4. 查找代理函数相关的信息

**应该看到：**
- ✅ 代理函数已部署
- ✅ 没有构建错误

---

### 步骤 3：测试代理函数

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
    console.log('1. 代理函数文件不存在');
    console.log('2. 代理函数未部署');
    console.log('3. 路径解析错误');
  });

// 测试发送验证码
fetch('/api/proxy/auth/send-code', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '18210827464' })
})
  .then(r => r.json())
  .then(data => {
    console.log('✅ 发送验证码成功:', data);
  })
  .catch(err => {
    console.error('❌ 发送验证码失败:', err);
  });
```

---

## 🔍 问题排查

### 如果仍然返回 404

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
- ❌ 错误：`[...path].js`（应该是 .ts）

**检查 3：确认目录结构**
```
frontend/
  ├── api/
  │   └── proxy/
  │       └── [...path].ts  ← 必须存在
  ├── vercel.json  ← 必须存在
  └── ...
```

**检查 4：查看 Vercel 部署日志**
- 进入 Vercel Dashboard → Deployments → Build Logs
- 查找是否有代理函数相关的错误
- 确认代理函数已部署

---

### 如果代理函数返回 500

**可能原因：**
1. 后端服务器未运行
2. 后端地址错误
3. 网络连接问题

**排查步骤：**
1. 检查后端服务器：`pm2 list`
2. 确认后端地址：`http://123.56.17.118:3000`
3. 测试后端连接：`curl http://123.56.17.118:3000/api/health`

---

## 📋 修复检查清单

### 代理函数文件

- [ ] 文件存在：`frontend/api/proxy/[...path].ts`
- [ ] 文件命名正确：`[...path].ts`（三个点）
- [ ] 代码正确：正确处理 POST 请求
- [ ] 路径解析正确：`req.query.path` 处理正确
- [ ] 安装了依赖：`@vercel/node`（如果需要）

### vercel.json 配置

- [ ] 文件存在：`frontend/vercel.json`
- [ ] 配置正确：使用 `(?!api/)` 排除 api/ 路径
- [ ] 代码已提交到 Git

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
- [ ] 确认不再返回 404 错误

---

## 🎯 预期结果

修复后应该：
- ✅ 不再返回 404 错误
- ✅ 代理函数正常工作
- ✅ POST 请求正常工作
- ✅ 可以发送验证码
- ✅ 登录功能正常

---

## 📝 总结

**问题：** Vercel 代理函数返回 404 错误

**可能原因：**
1. 代理函数文件不存在
2. 代理函数路径错误
3. 代理函数未正确部署

**解决步骤：**
1. ✅ 创建代理函数文件：`frontend/api/proxy/[...path].ts`
2. ✅ 确认 vercel.json 配置正确
3. ✅ 提交并部署
4. ✅ 验证修复

**如果问题仍然存在，请提供：**
1. Vercel 部署日志（Build Logs）
2. 代理函数文件内容
3. vercel.json 文件内容
4. 浏览器控制台的完整错误信息



