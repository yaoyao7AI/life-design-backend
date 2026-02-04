# 🔧 Vercel 代理 405 错误修复

## 🚨 问题

**错误信息：**
```
POST https://www.life-design.me/api/proxy/auth/send-code 405 (Method Not Allowed)
```

**问题分析：**
- ✅ 前端已使用代理路径：`/api/proxy/auth/send-code`
- ✅ 后端路由正常（直接测试返回 200）
- ❌ Vercel 代理函数返回 405

**可能原因：**
1. Vercel 代理函数未正确创建或部署
2. 代理函数路径解析错误
3. 代理函数未正确处理 POST 请求

---

## ✅ 解决方案

### 检查 1：确认代理函数文件存在

**文件路径：** `frontend/api/proxy/[...path].ts`

**确认文件存在：**
```bash
cd frontend
ls -la api/proxy/
# 应该看到：[...path].ts
```

---

### 检查 2：确认代理函数代码正确

**文件内容：** `frontend/api/proxy/[...path].ts`

**正确的代码：**

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
    const path = Array.isArray(req.query.path) 
      ? req.query.path.join('/') 
      : req.query.path || '';
    
    // 构建后端 URL
    const url = `${BACKEND_URL}/api/${path}`;
    
    console.log('[Vercel Proxy]', req.method, url, req.body);
    
    // 转发请求到后端
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' 
        ? JSON.stringify(req.body || {}) 
        : undefined,
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

---

### 检查 3：确认路径解析正确

**问题：** 如果请求是 `/api/proxy/auth/send-code`，Vercel 会：
1. 匹配到 `api/proxy/[...path].ts`
2. `req.query.path` 应该是 `['auth', 'send-code']`

**调试代码：**
```typescript
console.log('req.query:', req.query);
console.log('req.query.path:', req.query.path);
console.log('req.method:', req.method);
console.log('req.body:', req.body);
```

---

## 🔧 修复步骤

### 步骤 1：检查代理函数文件

**确认文件存在：**
```bash
cd frontend
ls -la api/proxy/[...path].ts
```

**如果文件不存在：**
- 创建目录：`mkdir -p api/proxy`
- 创建文件：`api/proxy/[...path].ts`
- 使用上面的正确代码

---

### 步骤 2：检查代理函数代码

**确认代码正确：**
- ✅ 导入了 `@vercel/node` 类型
- ✅ 正确处理了 `req.query.path`
- ✅ 正确处理了 POST 请求的 body
- ✅ 设置了正确的 CORS 头

---

### 步骤 3：检查 Vercel 部署日志

**在 Vercel Dashboard：**
1. 进入项目 → **Deployments**
2. 点击最新部署
3. 查看 **Build Logs**
4. 查找是否有代理函数相关的错误

**如果看到错误：**
- 检查文件路径是否正确
- 检查代码语法是否正确
- 检查是否安装了 `@vercel/node`

---

### 步骤 4：重新部署

**如果修改了代理函数：**
```bash
cd frontend
git add api/proxy/[...path].ts
git commit -m "Fix: Update Vercel proxy function"
git push origin main
```

**Vercel 会自动部署**

---

## 🧪 测试代理函数

### 测试 1：检查代理函数是否部署

**在浏览器控制台执行：**
```javascript
// 测试代理函数是否存在
fetch('/api/proxy/health', {
  method: 'GET'
})
  .then(r => r.json())
  .then(data => {
    console.log('✅ 代理函数正常:', data);
  })
  .catch(err => {
    console.error('❌ 代理函数失败:', err);
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

## 🔍 常见问题

### 问题 1：代理函数返回 404

**可能原因：**
- 文件路径错误
- 文件命名错误
- Vercel 未识别代理函数

**解决：**
- 确认文件路径：`frontend/api/proxy/[...path].ts`
- 确认文件命名：`[...path].ts`（不是 `[path].ts`）
- 重新部署

---

### 问题 2：代理函数返回 405

**可能原因：**
- 代理函数未正确处理 POST 请求
- 路径解析错误
- 方法检查有问题

**解决：**
- 检查代理函数代码
- 确认 `req.method` 正确处理
- 确认 `req.body` 正确传递

---

### 问题 3：代理函数返回 500

**可能原因：**
- 后端服务器未运行
- 后端地址错误
- 网络连接问题

**解决：**
- 检查后端服务器：`pm2 list`
- 确认后端地址：`http://123.56.17.118:3000`
- 测试后端连接

---

## 📋 修复检查清单

### 代理函数文件

- [ ] 文件存在：`frontend/api/proxy/[...path].ts`
- [ ] 文件命名正确：`[...path].ts`（三个点）
- [ ] 代码正确：正确处理 POST 请求
- [ ] 路径解析正确：`req.query.path` 处理正确

### Vercel 部署

- [ ] 代码已提交到 Git
- [ ] 代码已推送到 GitHub
- [ ] Vercel 已部署
- [ ] 部署日志没有错误

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

**可能原因：**
1. 代理函数未正确创建或部署
2. 代理函数路径解析错误
3. 代理函数未正确处理 POST 请求

**解决步骤：**
1. 检查代理函数文件是否存在
2. 检查代理函数代码是否正确
3. 检查 Vercel 部署日志
4. 重新部署（如果需要）

**如果问题仍然存在，请提供：**
1. Vercel 部署日志
2. 代理函数文件内容
3. 浏览器控制台的完整错误信息



