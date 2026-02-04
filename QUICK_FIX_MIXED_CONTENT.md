# ⚡ 快速修复 Mixed Content 错误

## 🚨 问题

**错误：** Mixed Content - HTTPS 页面请求 HTTP 资源被阻止

**页面：** https://www.life-design.me/me  
**错误信息：** `Failed to fetch`  
**控制台错误：** Mixed Content 错误

---

## ✅ 快速解决方案：使用 Vercel 代理

### 步骤 1：创建 Vercel 代理函数

**在 `frontend` 目录下创建：**

**目录结构：**
```
frontend/
  └── api/
      └── proxy/
          └── [...path].ts
```

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
    const path = Array.isArray(req.query.path) 
      ? req.query.path.join('/') 
      : req.query.path || '';
    
    const url = `${BACKEND_URL}/api/${path}`;
    
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
      },
      body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';
    
    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
```

---

### 步骤 2：修改前端 API 配置

**找到前端 API 配置文件：**
- `frontend/src/api/auth.ts`
- 或 `frontend/src/services/api.ts`
- 或 `frontend/src/utils/api.ts`

**修改 BASE_URL：**

**修改前：**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api';
```

**修改后：**
```typescript
const API_BASE_URL = import.meta.env.PROD
  ? '/api/proxy'  // 生产环境使用代理
  : import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api';
```

**完整示例：**
```typescript
// frontend/src/api/auth.ts

const BASE_URL = import.meta.env.PROD
  ? '/api/proxy'  // 生产环境：使用 Vercel 代理
  : import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api';

export async function sendVerificationCode(phone: string) {
  const response = await fetch(`${BASE_URL}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  
  if (!response.ok) {
    throw new Error('发送验证码失败');
  }
  
  return await response.json();
}

export async function login(phone: string, code: string) {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  
  if (!response.ok) {
    throw new Error('登录失败');
  }
  
  return await response.json();
}
```

---

### 步骤 3：安装 Vercel Node.js 类型（如果需要）

**如果 TypeScript 报错，安装类型：**
```bash
cd frontend
npm install --save-dev @vercel/node
```

---

### 步骤 4：提交并部署

```bash
cd frontend

# 添加文件
git add api/proxy/[...path].ts
git add src/api/auth.ts  # 或其他修改的文件

# 提交
git commit -m "Fix: Add Vercel proxy to resolve Mixed Content error"

# 推送
git push origin main
```

**Vercel 会自动检测到代码推送并部署**

---

### 步骤 5：验证修复

1. **等待部署完成**（1-3 分钟）
   - 在 Vercel Dashboard → Deployments 查看状态

2. **清除浏览器缓存**
   - Mac: `Cmd + Shift + R`
   - Windows: `Ctrl + Shift + R`

3. **测试登录功能**
   - 访问：https://www.life-design.me/me
   - 点击登录按钮
   - 输入手机号，点击"获取验证码"
   - 应该不再显示 Mixed Content 错误

---

## 🧪 测试代理

**在浏览器控制台（F12 → Console）执行：**

```javascript
// 测试代理是否工作
fetch('/api/proxy/health')
  .then(r => r.json())
  .then(data => {
    console.log('✅ 代理正常:', data);
  })
  .catch(err => {
    console.error('❌ 代理失败:', err);
  });

// 测试发送验证码（通过代理）
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

## 📋 检查清单

### 代码修改

- [ ] 创建了 `frontend/api/proxy/[...path].ts` 文件
- [ ] 修改了前端 API 配置文件
- [ ] 使用 `import.meta.env.PROD` 判断生产环境
- [ ] 生产环境使用 `/api/proxy`
- [ ] 开发环境使用 `VITE_API_BASE_URL` 或默认值

### 部署

- [ ] 代码已提交到 Git
- [ ] 代码已推送到 GitHub
- [ ] Vercel 已自动部署
- [ ] 部署状态为 "Ready"

### 验证

- [ ] 清除浏览器缓存
- [ ] 访问 https://www.life-design.me/me
- [ ] 检查浏览器控制台，没有 Mixed Content 错误
- [ ] 测试登录功能正常

---

## 🎯 工作原理

**生产环境（HTTPS）：**
```
前端请求：/api/proxy/auth/send-code
    ↓
Vercel 代理函数：api/proxy/[...path].ts
    ↓
转发到：http://123.56.17.118:3000/api/auth/send-code
    ↓
返回响应给前端
```

**开发环境（HTTP）：**
```
前端请求：http://123.56.17.118:3000/api/auth/send-code
    ↓
直接请求后端
```

---

## ✅ 预期结果

修复后：
- ✅ 不再显示 Mixed Content 错误
- ✅ 登录功能正常工作
- ✅ 可以发送验证码
- ✅ 可以登录

---

## 📝 总结

**问题：** Mixed Content - HTTPS 页面请求 HTTP 资源

**解决方案：** 使用 Vercel 代理函数

**步骤：**
1. ✅ 创建代理函数：`frontend/api/proxy/[...path].ts`
2. ✅ 修改前端 API 配置：生产环境使用 `/api/proxy`
3. ✅ 提交并部署
4. ✅ 验证修复

**完成这些步骤后，Mixed Content 错误应该解决！** 🚀



