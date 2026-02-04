# 🔧 前端 Base URL 配置修复

## ⚠️ 问题分析

**错误信息：**
```
The server is configured with a public base URL of `/admin/` – 
did you mean to visit `/admin/play?a=005` instead?
```

**问题原因：**
- 前端 Vite 配置中设置了 `base: '/admin/'`
- 这导致所有前端路由都需要加上 `/admin/` 前缀
- 访问 `localhost:5174/play?a=005` 时，Vite 认为应该访问 `/admin/play?a=005`

---

## ✅ 解决方案

### 方案 1：修改前端 Vite 配置（推荐）

**文件位置：** `frontend/vite.config.js` 或 `frontend/vite.config.ts`

**当前配置（错误）：**
```javascript
export default {
  base: '/admin/',  // ❌ 这导致所有路由都需要 /admin/ 前缀
  // ... 其他配置
}
```

**应该改为：**
```javascript
export default {
  base: '/',  // ✅ 使用根路径
  // ... 其他配置
}
```

**或者完全移除 base 配置：**
```javascript
export default {
  // base 配置默认就是 '/'，可以不写
  // ... 其他配置
}
```

**修改后：**
1. 重启前端开发服务器
2. 清除浏览器缓存
3. 访问 `localhost:5174/play?a=005` 应该可以正常工作

---

### 方案 2：如果确实需要 `/admin/` 作为基础路径

如果你确实希望前端应用部署在 `/admin/` 路径下，那么需要：

#### 2.1 更新后端 FRONTEND_BASE_URL

**文件：** `.env`（服务器上）

**当前配置：**
```env
FRONTEND_BASE_URL=http://localhost:5174
```

**应该改为：**
```env
FRONTEND_BASE_URL=http://localhost:5174/admin
```

**然后重启后端：**
```bash
pm2 restart life-design-backend
```

#### 2.2 更新短链接生成逻辑

短链接会变成：`http://localhost:5174/admin/play?a=005`

---

## 🔍 如何检查前端配置

### 1. 检查 vite.config.js

**文件位置：** `frontend/vite.config.js` 或 `frontend/vite.config.ts`

**查找：**
```javascript
export default {
  base: '/admin/',  // ← 如果看到这个，就是问题所在
  // ...
}
```

### 2. 检查 package.json

**文件位置：** `frontend/package.json`

**查找：**
```json
{
  "scripts": {
    "dev": "vite --base /admin/"  // ← 如果看到这个，也是问题
  }
}
```

---

## 🛠️ 修复步骤

### 步骤 1：修改前端配置

**编辑 `frontend/vite.config.js`：**
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',  // ✅ 改为根路径
  // 或者直接删除 base 配置
})
```

### 步骤 2：重启前端服务器

```bash
cd frontend
# 停止当前服务器（Ctrl+C）
npm run dev
```

### 步骤 3：清除浏览器缓存

- 按 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（Mac）强制刷新
- 或使用无痕模式测试

### 步骤 4：测试访问

访问 `http://localhost:5174/play?a=005` 应该可以正常打开播放页面。

---

## 📋 配置对比

### ❌ 错误配置（当前）

**vite.config.js：**
```javascript
export default {
  base: '/admin/',  // ❌ 导致所有路由都需要 /admin/ 前缀
}
```

**访问：**
- `localhost:5174/play` → 错误，提示访问 `/admin/play`
- `localhost:5174/admin/play` → 可以访问，但不是预期行为

**短链接：**
- 后端生成：`http://localhost:5174/play?a=005`
- 实际需要：`http://localhost:5174/admin/play?a=005`
- ❌ 不匹配！

---

### ✅ 正确配置（推荐）

**vite.config.js：**
```javascript
export default {
  base: '/',  // ✅ 使用根路径
}
```

**访问：**
- `localhost:5174/play` → ✅ 正常工作
- `localhost:5174/admin/play` → 404（因为路由是 `/play`）

**短链接：**
- 后端生成：`http://localhost:5174/play?a=005`
- 实际访问：`http://localhost:5174/play?a=005`
- ✅ 匹配！

---

## 🎯 推荐方案

**推荐使用方案 1：修改前端配置为 `base: '/'`**

**原因：**
1. ✅ 短链接更简洁：`/play?a=005` 而不是 `/admin/play?a=005`
2. ✅ 符合常规前端应用部署方式
3. ✅ 不需要修改后端配置
4. ✅ 用户体验更好

**如果确实需要 `/admin/` 路径：**
- 通常用于管理后台应用
- 如果这是管理后台，那么使用 `/admin/` 是合理的
- 但需要同时更新后端 `FRONTEND_BASE_URL` 配置

---

## 🧪 验证修复

### 1. 检查前端配置

```bash
cd frontend
cat vite.config.js | grep base
```

**应该看到：**
```javascript
base: '/',  // ✅ 或者没有 base 配置
```

**不应该看到：**
```javascript
base: '/admin/',  // ❌
```

### 2. 测试访问

访问 `http://localhost:5174/play?a=005`：
- ✅ 应该正常打开播放页面
- ❌ 不应该看到 "did you mean to visit /admin/play" 的错误

### 3. 测试短链接

从后端获取短链接：
```bash
curl http://123.56.17.118:3000/api/affirmations/005
```

返回的 `short_url` 应该是：
```json
{
  "short_url": "http://localhost:5174/play?a=005"
}
```

访问这个 URL 应该可以正常打开播放页面。

---

## 📝 总结

**问题：** 前端 Vite 配置了 `base: '/admin/'`，导致路由不匹配

**解决方案：**
1. ✅ 修改 `frontend/vite.config.js`，将 `base` 改为 `'/'`
2. ✅ 重启前端服务器
3. ✅ 清除浏览器缓存
4. ✅ 测试访问 `/play?a=005`

**如果确实需要 `/admin/` 路径：**
1. 保持前端 `base: '/admin/'`
2. 更新后端 `.env` 中的 `FRONTEND_BASE_URL=http://localhost:5174/admin`
3. 重启后端服务器

**推荐：** 使用方案 1（修改前端配置为根路径）



