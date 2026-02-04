# ✅ BASE_URL 环境判断修复 - 最终版本

## 🎯 问题根源（用户分析）

**核心矛盾：**
- ❌ 代码中可能访问了不存在的 `/api/sendCode` 接口
- ✅ 正确的接口应该是 `/api/proxy/auth/send-code`

**真正原因：**
- Vite 的 `import.meta.env.PROD` 判断不够可靠
- 环境变量判断逻辑复杂，可能导致生产环境误判

---

## ✅ 修复方案

### 修复思路（按用户建议）

**简化环境判断逻辑：**
- ✅ 不再依赖 `import.meta.env.PROD`
- ✅ 直接检查 `window.location.hostname`
- ✅ 如果**不是 localhost**，**强制使用** `/api/proxy`

---

## 📝 修复的文件

### 1. `frontend/src/api/auth.ts`

**修复前：**
```typescript
const isProduction = import.meta.env.PROD || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1'));

const BASE_URL = isProduction
  ? '/api/proxy'
  : import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api';
```

**修复后：**
```typescript
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname.includes('localhost'));

const BASE_URL = isLocalhost
  ? (import.meta.env.VITE_API_BASE_URL || 'http://123.56.17.118:3000/api')
  : '/api/proxy';  // 生产环境：强制使用 Vercel 代理
```

**关键改进：**
- ✅ 逻辑更简单：只判断是否为 localhost
- ✅ 非 localhost 一律使用 `/api/proxy`
- ✅ 添加详细的调试日志

---

### 2. `frontend/src/utils/request.ts`

**同样修复：**
- ✅ 使用相同的 `isLocalhost` 判断逻辑
- ✅ 统一 BASE_URL 处理方式

---

### 3. `frontend/src/utils/upload.ts`

**同样修复：**
- ✅ 使用相同的 `isLocalhost` 判断逻辑
- ✅ 统一 BASE_URL 处理方式

---

## 🔍 验证步骤

### 步骤 1：检查代码已提交

```bash
cd /Users/mac/Desktop/affirmation-mvp/frontend
git status
```

---

### 步骤 2：提交并推送代码

```bash
git add src/api/auth.ts src/utils/request.ts src/utils/upload.ts
git commit -m "Fix: Simplify BASE_URL detection - force /api/proxy for production"
git push origin main
```

---

### 步骤 3：等待 Vercel 部署完成

1. 进入 Vercel Dashboard → Deployments
2. 等待最新部署状态变为 "Ready"

---

### 步骤 4：验证修复

#### 4.1 检查浏览器控制台日志

**访问：** `https://www.life-design.me/me`

**打开浏览器控制台（F12 → Console），应该看到：**

```javascript
[Auth API] 环境检测: {
  hostname: "www.life-design.me",
  isLocalhost: false,
  BASE_URL: "/api/proxy",
  PROD: true,
  VITE_API_BASE_URL: undefined
}
```

**关键检查点：**
- ✅ `isLocalhost: false`（生产环境）
- ✅ `BASE_URL: "/api/proxy"`（强制使用代理）

---

#### 4.2 测试发送验证码

**点击 "获取验证码" 按钮**

**在 Network 标签中查看请求：**
- ✅ **请求 URL：** `https://www.life-design.me/api/proxy/auth/send-code`
- ✅ **状态码：** 200 或 400（不是 404）
- ✅ **响应：** JSON 格式

**如果返回 404：**
- ❌ 检查 Vercel 函数是否被调用
- ❌ 查看 Vercel 运行时日志

---

#### 4.3 检查 Vercel 运行时日志

**操作：**
1. 进入 Vercel Dashboard → 项目 → **Logs**
2. 开启 **Live** 开关
3. 在前端页面点击 "获取验证码"
4. **应该看到日志：**

```
[Proxy] Function called: { method: 'POST', url: '/api/proxy/auth/send-code', ... }
[Proxy] Incoming request: { method: 'POST', ... }
[Proxy] Request: { method: 'POST', ... }
[Proxy] POST http://123.56.17.118:3000/api/auth/send-code
[Proxy] Response status: 200
```

**如果没有日志：**
- ❌ 函数可能没有被调用
- ❌ 需要检查 `vercel.json` 配置

---

## 📋 修复检查清单

### 代码修复
- [x] `src/api/auth.ts` - BASE_URL 判断逻辑已简化
- [x] `src/utils/request.ts` - BASE_URL 判断逻辑已统一
- [x] `src/utils/upload.ts` - BASE_URL 判断逻辑已统一
- [x] 添加详细的调试日志

### 部署验证
- [ ] 代码已提交到 Git
- [ ] 代码已推送到 GitHub
- [ ] Vercel 已自动部署
- [ ] 部署状态为 "Ready"

### 功能验证
- [ ] 清除浏览器缓存（硬刷新）
- [ ] 访问 `https://www.life-design.me/me`
- [ ] 检查浏览器控制台日志（BASE_URL 应该是 `/api/proxy`）
- [ ] 点击 "获取验证码"
- [ ] 检查 Network 标签（请求 URL 应该是 `/api/proxy/auth/send-code`）
- [ ] 检查 Vercel 运行时日志（应该有函数调用日志）

---

## 🎯 预期结果

修复后应该：

1. **浏览器控制台日志：**
   ```
   [Auth API] 环境检测: {
     hostname: "www.life-design.me",
     isLocalhost: false,
     BASE_URL: "/api/proxy"
   }
   ```

2. **Network 请求：**
   - URL: `https://www.life-design.me/api/proxy/auth/send-code`
   - 状态码: 200 或 400（不是 404）
   - 响应: JSON 格式

3. **Vercel 运行时日志：**
   - 有函数调用日志
   - 有请求转发日志
   - 有响应状态日志

---

## 🔧 如果仍然有问题

### 问题 1：仍然返回 404

**检查：**
1. Vercel 函数是否被调用（查看运行时日志）
2. `vercel.json` 配置是否正确
3. Vercel Root Directory 设置

---

### 问题 2：BASE_URL 仍然是错误的

**检查：**
1. 浏览器控制台日志中的 `hostname` 值
2. `isLocalhost` 判断是否正确
3. 是否有浏览器缓存问题

---

### 问题 3：函数被调用但后端返回错误

**检查：**
1. 后端服务器是否运行：`pm2 list`
2. 后端地址是否正确：`http://123.56.17.118:3000`
3. 后端路由是否正确：`/api/auth/send-code`

---

## 📝 总结

**修复内容：**
- ✅ 简化 BASE_URL 环境判断逻辑
- ✅ 强制生产环境使用 `/api/proxy`
- ✅ 统一所有文件的 BASE_URL 处理方式
- ✅ 添加详细的调试日志

**关键改进：**
- ✅ 不再依赖不可靠的 `import.meta.env.PROD`
- ✅ 直接检查 `hostname`，逻辑更清晰
- ✅ 非 localhost 一律使用代理，避免误判

**下一步：**
1. 提交并推送代码
2. 等待 Vercel 部署完成
3. 验证修复效果



