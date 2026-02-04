# 🔧 Vercel 代理函数 404 错误修复

## 🚨 问题

**错误信息：**
```
The page could not be found NOT_FOUND
POST /api/proxy/auth/send-code 404
```

**Build Logs 分析：**
- ✅ 构建成功
- ✅ 没有构建错误
- ❌ **没有看到代理函数部署信息**

**问题：** Vercel 没有识别到代理函数

---

## ✅ 解决方案

### 方案 1：确认代理函数文件存在（必须）

#### 检查文件路径

**正确的文件路径：** `frontend/api/proxy/[...path].ts`

**目录结构：**
```
frontend/
  ├── api/
  │   └── proxy/
  │       └── [...path].ts  ← 必须存在
  ├── vercel.json
  └── ...
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

#### 确认文件命名

**正确的命名：**
- ✅ `[...path].ts`（三个点，捕获所有路径）

**错误的命名：**
- ❌ `[path].ts`（一个点）
- ❌ `path.ts`
- ❌ `[...path].js`（应该是 .ts）

---

### 方案 2：创建正确的代理函数文件

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
    
    console.log('[Vercel Proxy]', req.method, url, req.body);
    
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

---

### 方案 3：检查 package.json 配置

**文件：** `frontend/package.json`

**确认包含：**
```json
{
  "dependencies": {
    "@vercel/node": "^3.x.x"
  },
  "devDependencies": {
    "@vercel/node": "^3.x.x"
  }
}
```

**如果不存在，安装：**
```bash
cd frontend
npm install --save-dev @vercel/node
```

---

### 方案 4：检查 vercel.json 配置

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

### 方案 5：检查项目结构

**Vercel 需要识别 `api/` 目录作为 serverless functions**

**确认项目结构：**
```
frontend/
  ├── api/              ← Vercel 会自动识别这个目录
  │   └── proxy/
  │       └── [...path].ts
  ├── src/
  ├── vercel.json
  └── package.json
```

**如果 `api/` 目录不在 `frontend/` 根目录：**
- 需要移动到正确位置
- 或配置 `vercel.json` 指定函数目录

---

## 🔍 问题排查

### 检查 1：确认文件存在

**在本地检查：**
```bash
cd frontend
ls -la api/proxy/[...path].ts
```

**如果文件不存在：**
- 创建文件（见方案 2）

---

### 检查 2：查看 Vercel 部署日志

**在 Vercel Dashboard：**
1. 进入项目 → **Deployments**
2. 点击最新部署
3. 查看 **Build Logs**
4. 查找 "Functions" 或 "Serverless Functions" 相关信息

**应该看到：**
```
Functions:
  api/proxy/[...path].ts
```

**如果没有看到：**
- 代理函数文件不存在或路径错误
- 需要创建或修复文件

---

### 检查 3：检查文件命名

**确认文件命名：**
- ✅ `[...path].ts`（三个点）
- ❌ `[path].ts`（一个点）
- ❌ `path.ts`

**Vercel 使用 `[...path]` 来捕获所有路径参数**

---

### 检查 4：测试代理函数

**在浏览器控制台（F12 → Console）执行：**

```javascript
// 测试代理函数是否存在
fetch('/api/proxy/health')
  .then(r => {
    console.log('状态码:', r.status);
    return r.json();
  })
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
```

---

## 📋 完整修复步骤

### 步骤 1：创建代理函数文件

**创建文件：** `frontend/api/proxy/[...path].ts`

**使用方案 2 中的代码**

---

### 步骤 2：安装依赖

**如果 TypeScript 报错：**
```bash
cd frontend
npm install --save-dev @vercel/node
```

---

### 步骤 3：确认 vercel.json

**确认配置正确：**
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

---

### 步骤 4：提交并部署

```bash
cd frontend

# 添加文件
git add api/proxy/[...path].ts
git add vercel.json
git add package.json  # 如果修改了依赖

# 提交
git commit -m "Fix: Add Vercel proxy function for API requests"

# 推送
git push origin main
```

**Vercel 会自动部署**

---

### 步骤 5：验证部署

**在 Vercel Dashboard：**
1. 进入项目 → **Deployments**
2. 点击最新部署
3. 查看 **Build Logs**
4. 查找 "Functions" 相关信息

**应该看到：**
```
Functions:
  api/proxy/[...path].ts
```

---

## 🧪 验证步骤

### 步骤 1：检查部署日志

**在 Vercel Dashboard → Deployments → Build Logs：**

**应该看到：**
- ✅ 构建成功
- ✅ Functions 列表包含 `api/proxy/[...path].ts`

---

### 步骤 2：测试代理函数

**在浏览器控制台（F12 → Console）执行：**

```javascript
// 测试代理函数
fetch('/api/proxy/health')
  .then(r => r.json())
  .then(data => {
    console.log('✅ 代理函数正常:', data);
  })
  .catch(err => {
    console.error('❌ 代理函数失败:', err);
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

## 📋 修复检查清单

### 代理函数文件

- [ ] 文件存在：`frontend/api/proxy/[...path].ts`
- [ ] 文件命名正确：`[...path].ts`（三个点）
- [ ] 代码正确：正确处理 POST 请求
- [ ] 路径解析正确：`req.query.path` 处理正确

### 依赖

- [ ] 安装了 `@vercel/node`（如果需要）
- [ ] package.json 已更新

### vercel.json 配置

- [ ] 文件存在：`frontend/vercel.json`
- [ ] 配置正确：使用 `(?!api/)` 排除 api/ 路径

### Vercel 部署

- [ ] 代码已提交到 Git
- [ ] 代码已推送到 GitHub
- [ ] Vercel 已部署
- [ ] 部署日志显示 Functions 已部署
- [ ] 部署状态为 "Ready"

---

## 🎯 预期结果

修复后应该：

1. ✅ **Build Logs 显示 Functions：**
   ```
   Functions:
     api/proxy/[...path].ts
   ```

2. ✅ **不再返回 404 错误**
   - Console 中没有 404 错误
   - Network 中请求状态为 200 OK

3. ✅ **登录功能正常工作**
   - 可以点击登录按钮
   - 可以输入手机号
   - 可以发送验证码
   - 可以登录成功

---

## 📝 总结

**问题：** Vercel 代理函数返回 404，Build Logs 没有显示 Functions

**可能原因：**
1. 代理函数文件不存在
2. 代理函数文件路径错误
3. 代理函数文件命名错误
4. Vercel 没有识别到代理函数

**解决步骤：**
1. ✅ 创建代理函数文件：`frontend/api/proxy/[...path].ts`
2. ✅ 确认文件命名正确：`[...path].ts`（三个点）
3. ✅ 确认 vercel.json 配置正确
4. ✅ 提交并部署
5. ✅ 验证 Build Logs 显示 Functions

**如果问题仍然存在，请提供：**
1. 代理函数文件是否存在（`ls -la api/proxy/[...path].ts`）
2. Vercel 部署日志中的 Functions 部分
3. 浏览器控制台的完整错误信息



