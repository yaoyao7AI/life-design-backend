# 🔧 Mixed Content 错误修复方案

## 🚨 问题确认

**错误信息：**
```
Mixed Content: The page at 'https://www.life-design.me/me' 
was loaded over HTTPS, but requested an insecure resource 
'http://123.56.17.118:3000/api/auth/send-code'. 
This request has been blocked; the content must be served over HTTPS.
```

**问题原因：**
- ✅ 前端是 HTTPS：`https://www.life-design.me`
- ❌ API 是 HTTP：`http://123.56.17.118:3000`
- ❌ 浏览器安全策略阻止 HTTPS 页面请求 HTTP 资源

---

## ✅ 解决方案（3 种）

### 方案 1：配置后端 HTTPS（推荐，最佳方案）

**优点：**
- ✅ 完全解决混合内容问题
- ✅ 更安全
- ✅ 符合最佳实践
- ✅ 长期解决方案

**缺点：**
- ⚠️ 需要配置 SSL 证书
- ⚠️ 需要配置 Nginx 反向代理

---

#### 步骤 1：安装 Nginx 和 Certbot

**在服务器上执行：**
```bash
# 更新系统
sudo apt-get update

# 安装 Nginx
sudo apt-get install nginx -y

# 安装 Certbot（Let's Encrypt）
sudo apt-get install certbot python3-certbot-nginx -y
```

---

#### 步骤 2：配置 Nginx 反向代理

**创建配置文件：** `/etc/nginx/sites-available/api.life-design.me`

```nginx
server {
    listen 80;
    server_name api.life-design.me;

    # 重定向 HTTP 到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.life-design.me;

    # SSL 证书路径（Certbot 会自动配置）
    ssl_certificate /etc/letsencrypt/live/api.life-design.me/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.life-design.me/privkey.pem;

    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 反向代理到 Node.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**启用配置：**
```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/api.life-design.me /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

---

#### 步骤 3：获取 SSL 证书

```bash
# 获取 SSL 证书
sudo certbot --nginx -d api.life-design.me

# 按照提示操作：
# 1. 输入邮箱
# 2. 同意服务条款
# 3. 选择是否分享邮箱（可选）
# 4. Certbot 会自动配置 SSL
```

---

#### 步骤 4：更新 Vercel 环境变量

**在 Vercel Dashboard：**
1. 进入项目 → **Settings** → **Environment Variables**
2. 修改 `VITE_API_BASE_URL`：
   ```
   VITE_API_BASE_URL=https://api.life-design.me/api
   ```
3. 保存
4. 重新部署前端

---

### 方案 2：使用 Vercel 代理（临时方案）

**优点：**
- ✅ 不需要配置后端 HTTPS
- ✅ 快速解决混合内容问题
- ✅ 不需要修改服务器配置

**缺点：**
- ⚠️ 增加延迟（通过 Vercel 代理）
- ⚠️ 需要修改前端代码
- ⚠️ 需要创建代理函数

---

#### 步骤 1：创建 Vercel 代理函数

**创建文件：** `frontend/api/proxy/[...path].ts`

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

#### 步骤 2：修改前端 API 配置

**修改前端代码：** `frontend/src/api/auth.ts` 或类似文件

```typescript
// 根据环境选择 API 地址
const BASE_URL = import.meta.env.PROD
  ? '/api/proxy'  // 生产环境使用代理
  : import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api';

// 使用示例
export async function sendVerificationCode(phone: string) {
  const response = await fetch(`${BASE_URL}/auth/send-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  return await response.json();
}
```

---

#### 步骤 3：更新 Vercel 环境变量

**删除或修改 `VITE_API_BASE_URL`：**
- 如果使用代理，可以删除这个环境变量
- 或者设置为空字符串

---

### 方案 3：修改前端使用相对路径（如果 Vercel 配置了代理）

**如果 Vercel 已经配置了 `vercel.json` 代理：**

**检查 `frontend/vercel.json`：**
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://123.56.17.118:3000/api/:path*"
    }
  ]
}
```

**修改前端代码：**
```typescript
const BASE_URL = import.meta.env.PROD
  ? '/api'  // 生产环境使用相对路径
  : import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api';
```

---

## 🎯 推荐方案

### 短期解决方案（快速修复）

**使用方案 2：Vercel 代理**
- ✅ 快速实现
- ✅ 不需要服务器配置
- ✅ 立即解决混合内容问题

---

### 长期解决方案（最佳实践）

**使用方案 1：配置后端 HTTPS**
- ✅ 更安全
- ✅ 性能更好
- ✅ 符合最佳实践

---

## 📋 快速修复步骤（方案 2：Vercel 代理）

### 步骤 1：创建代理函数

**在 `frontend` 目录下创建：**
- 目录：`frontend/api/proxy/`
- 文件：`frontend/api/proxy/[...path].ts`

**文件内容：**（见上方方案 2）

---

### 步骤 2：修改前端 API 配置

**找到前端 API 配置文件：**
- `frontend/src/api/auth.ts`
- 或 `frontend/src/services/api.ts`
- 或类似文件

**修改 BASE_URL：**
```typescript
const BASE_URL = import.meta.env.PROD
  ? '/api/proxy'  // 生产环境使用代理
  : import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api';
```

---

### 步骤 3：提交并部署

```bash
cd frontend
git add .
git commit -m "Add Vercel proxy for API requests"
git push origin main
```

**Vercel 会自动部署**

---

### 步骤 4：验证修复

1. **等待部署完成**
2. **清除浏览器缓存**
3. **访问：** https://www.life-design.me/me
4. **测试登录功能**

---

## 🧪 验证步骤

### 测试代理是否工作

**在浏览器控制台执行：**
```javascript
// 测试代理
fetch('/api/proxy/health')
  .then(r => r.json())
  .then(data => console.log('✅ 代理正常:', data))
  .catch(err => console.error('❌ 代理失败:', err));
```

---

## 📝 总结

**问题：** Mixed Content 错误 - HTTPS 页面请求 HTTP 资源

**解决方案：**
1. ✅ **方案 1：配置后端 HTTPS**（推荐，长期）
2. ✅ **方案 2：使用 Vercel 代理**（快速，临时）
3. ✅ **方案 3：使用相对路径**（如果已配置代理）

**推荐：** 先使用方案 2 快速修复，然后配置方案 1 作为长期解决方案。

---

## 🆘 需要帮助？

如果实施过程中遇到问题，请提供：
1. 错误信息
2. 代码修改内容
3. 部署日志



