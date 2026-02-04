# ✅ 线上登录问题修复检查清单

## 🎯 当前状态

### ✅ 后端已完成的修复

- [x] CORS 配置已更新，包含 `https://www.life-design.me` ✅
- [x] CORS 配置已更新，包含 `https://life-design.me` ✅
- [x] 后端服务器已重启 ✅
- [x] CORS 测试通过 ✅

---

## ⚠️ 前端需要检查（重要！）

### 步骤 1：检查 Vercel 环境变量 ⚠️ **必须**

**操作步骤：**
1. 登录 Vercel Dashboard：https://vercel.com
2. 进入项目：`life-design`
3. 进入：**Settings** → **Environment Variables**
4. 检查是否存在 `VITE_API_BASE_URL`

**如果不存在或值错误：**
- 点击 **"Add New"**
- **Key：** `VITE_API_BASE_URL`
- **Value：** `http://123.56.17.118:3000/api`
- **Environment：** 选择 `Production`, `Preview`, `Development`
- 点击 **"Save"**

**然后重新部署：**
- 进入：**Deployments**
- 找到最新部署，点击 **"..."** → **"Redeploy"**
- 等待 1-3 分钟

---

### 步骤 2：检查浏览器控制台

**操作步骤：**
1. 打开：https://www.life-design.me/me
2. 按 `F12` 打开开发者工具
3. 切换到 **Console** 标签
4. 查看错误信息

**可能看到的错误：**

**错误 1：Mixed Content**
```
Mixed Content: The page at 'https://www.life-design.me' 
was loaded over HTTPS, but requested an insecure resource 
'http://123.56.17.118:3000/api/...'
```
**解决方案：** 需要配置后端 HTTPS 或使用代理

**错误 2：Failed to fetch**
- 可能是环境变量未配置
- 可能是网络问题
- 检查 Network 标签查看详细错误

**错误 3：CORS 错误**
```
Access to fetch at 'http://...' from origin 'https://...' 
has been blocked by CORS policy
```
**解决方案：** 后端 CORS 已配置，如果仍有问题，检查后端是否重启

---

### 步骤 3：检查 Network 标签

**操作步骤：**
1. 打开开发者工具（F12）
2. 切换到 **Network** 标签
3. 点击"获取验证码"按钮
4. 查看请求状态

**可能的状态：**

**状态 1：blocked（被阻止）**
- 通常是 Mixed Content 问题
- 需要配置后端 HTTPS 或使用代理

**状态 2：CORS error**
- 检查后端 CORS 配置
- 确认后端已重启

**状态 3：404 或 500**
- 检查 API 地址是否正确
- 检查后端服务器是否运行

---

### 步骤 4：测试 API 连接

**在浏览器控制台（F12 → Console）执行：**

```javascript
// 1. 检查环境变量
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

// 2. 测试后端连接
fetch('http://123.56.17.118:3000/api/health')
  .then(r => r.json())
  .then(data => {
    console.log('✅ 后端连接正常:', data);
  })
  .catch(err => {
    console.error('❌ 后端连接失败:', err);
  });

// 3. 测试发送验证码
fetch('http://123.56.17.118:3000/api/auth/send-code', {
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

## 🔧 如果看到 Mixed Content 错误

### 方案 A：配置后端 HTTPS（推荐）

**使用 Nginx + Let's Encrypt：**

1. **安装 Certbot**
   ```bash
   sudo apt-get update
   sudo apt-get install certbot python3-certbot-nginx
   ```

2. **配置 Nginx**
   ```nginx
   server {
       listen 443 ssl;
       server_name api.life-design.me;
       
       ssl_certificate /etc/letsencrypt/live/api.life-design.me/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/api.life-design.me/privkey.pem;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. **获取 SSL 证书**
   ```bash
   sudo certbot --nginx -d api.life-design.me
   ```

4. **更新 Vercel 环境变量**
   ```
   VITE_API_BASE_URL=https://api.life-design.me/api
   ```

---

### 方案 B：使用 Vercel 代理（临时）

**如果前端代码已配置代理：**
- 确认代码在生产环境使用 `/api/proxy`
- 确认代理函数已部署

**如果未配置代理：**
- 需要创建代理函数（见之前的文档）
- 修改前端代码使用代理

---

## 📋 完整检查清单

### Vercel 配置

- [ ] 环境变量 `VITE_API_BASE_URL` 已添加
- [ ] 环境变量值：`http://123.56.17.118:3000/api`
- [ ] 环境变量应用于 Production 环境
- [ ] 前端已重新部署

### 浏览器测试

- [ ] 清除浏览器缓存（Cmd+Shift+R 或 Ctrl+Shift+R）
- [ ] 打开 https://www.life-design.me/me
- [ ] 检查浏览器控制台（F12 → Console）
- [ ] 检查 Network 标签（F12 → Network）
- [ ] 测试 API 连接（控制台执行测试代码）

### 后端配置 ✅

- [x] CORS 配置包含 `https://www.life-design.me` ✅
- [x] CORS 配置包含 `https://life-design.me` ✅
- [x] 后端服务器已重启 ✅
- [x] CORS 测试通过 ✅

---

## 🎯 预期结果

修复后应该能够：

1. ✅ 访问 https://www.life-design.me/me
2. ✅ 点击登录按钮，弹出登录弹窗
3. ✅ 输入手机号，点击"获取验证码"
4. ✅ 看到成功提示或收到短信验证码
5. ✅ 输入验证码，点击"登录"
6. ✅ 登录成功，显示用户信息

---

## 📞 如果仍然无法登录

请提供以下信息：

1. **浏览器控制台截图**（F12 → Console）
2. **Network 标签截图**（F12 → Network，查看失败的请求）
3. **Vercel 环境变量截图**（Settings → Environment Variables）
4. **测试 API 连接的结果**（控制台执行测试代码的输出）

---

## ✅ 快速测试命令

在浏览器控制台（F12 → Console）执行：

```javascript
// 检查所有相关信息
console.log('=== 诊断信息 ===');
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
console.log('当前域名:', window.location.origin);

// 测试后端连接
fetch('http://123.56.17.118:3000/api/health')
  .then(r => r.json())
  .then(data => console.log('✅ 后端正常:', data))
  .catch(err => console.error('❌ 后端失败:', err));
```

---

## 📝 总结

**后端状态：** ✅ 已修复
- CORS 配置已更新
- 服务器已重启
- 测试通过

**前端需要：**
1. ⚠️ 检查 Vercel 环境变量配置
2. ⚠️ 重新部署前端（如果修改了环境变量）
3. ⚠️ 检查是否有 Mixed Content 错误

**下一步：**
1. 在 Vercel 中添加环境变量
2. 重新部署前端
3. 清除浏览器缓存并测试
4. 如果仍有 Mixed Content 错误，配置后端 HTTPS 或使用代理



