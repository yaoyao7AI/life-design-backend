# 🚀 快速修复：前端 Base URL 配置

## ⚡ 快速修复步骤

### 步骤 1：找到并编辑前端配置文件

**文件位置：** `frontend/vite.config.js` 或 `frontend/vite.config.ts`

**查找以下内容：**
```javascript
export default {
  base: '/admin/',  // ← 找到这一行
  // ...
}
```

### 步骤 2：修改配置

**将：**
```javascript
base: '/admin/',
```

**改为：**
```javascript
base: '/',
```

**或者直接删除 `base` 这一行**（因为默认值就是 `'/'`）

### 步骤 3：重启前端服务器

```bash
cd frontend
# 按 Ctrl+C 停止当前服务器
npm run dev
```

### 步骤 4：清除浏览器缓存并测试

1. **清除缓存：**
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
   - 或使用无痕模式

2. **测试访问：**
   - 访问：`http://localhost:5174/play?a=005`
   - 应该正常打开播放页面，不再显示错误提示

---

## ✅ 验证修复成功

### 检查点 1：不再显示错误提示

访问 `http://localhost:5174/play?a=005` 时：
- ✅ 应该正常打开播放页面
- ❌ 不应该看到 "did you mean to visit /admin/play" 的错误

### 检查点 2：短链接正常工作

1. **获取短链接：**
   ```bash
   curl http://123.56.17.118:3000/api/affirmations/005
   ```

2. **返回的 short_url 应该是：**
   ```json
   {
     "short_url": "http://localhost:5174/play?a=005"
   }
   ```

3. **访问这个 URL 应该正常工作**

---

## 📋 完整配置示例

### vite.config.js（修复后）

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',  // ✅ 使用根路径（或者删除这一行，默认就是 '/'）
  server: {
    port: 5174,
    // ... 其他服务器配置
  },
  // ... 其他配置
})
```

---

## 🔍 如果问题仍然存在

### 检查 1：确认配置文件已保存

确保 `vite.config.js` 文件已保存，并且 `base` 配置已修改。

### 检查 2：确认服务器已重启

确保前端开发服务器已完全重启（停止后重新启动）。

### 检查 3：检查 package.json

检查 `package.json` 中的 scripts 是否也设置了 base：

```json
{
  "scripts": {
    "dev": "vite --base /admin/"  // ❌ 如果看到这个，需要修改
  }
}
```

**应该改为：**
```json
{
  "scripts": {
    "dev": "vite"  // ✅ 或者 "vite --base /"
  }
}
```

### 检查 4：清除所有缓存

1. **清除浏览器缓存：**
   - 打开开发者工具（F12）
   - 右键点击刷新按钮
   - 选择"清空缓存并硬性重新加载"

2. **清除 Vite 缓存：**
   ```bash
   cd frontend
   rm -rf node_modules/.vite
   npm run dev
   ```

---

## 📝 总结

**问题：** 前端 Vite 配置了 `base: '/admin/'`，导致路由不匹配

**解决方案：**
1. ✅ 修改 `frontend/vite.config.js`，将 `base` 改为 `'/'` 或删除
2. ✅ 重启前端服务器
3. ✅ 清除浏览器缓存
4. ✅ 测试访问 `/play?a=005`

**预期结果：**
- ✅ 访问 `localhost:5174/play?a=005` 正常打开播放页面
- ✅ 不再显示 "did you mean to visit /admin/play" 错误
- ✅ 短链接正常工作

---

## 🆘 需要帮助？

如果修复后问题仍然存在，请提供：
1. `vite.config.js` 文件的完整内容
2. `package.json` 中的 scripts 配置
3. 浏览器控制台的错误信息
4. 访问 `localhost:5174/play?a=005` 时的实际行为



