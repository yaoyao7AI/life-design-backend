# 📝 Vercel 环境变量配置指南

## 🎯 目标

在 Vercel 中添加 `VITE_API_BASE_URL` 环境变量，使前端能够正确连接到后端 API。

---

## 🔧 详细操作步骤

### 步骤 1：登录 Vercel Dashboard

1. **访问 Vercel 网站**
   - 打开浏览器，访问：https://vercel.com
   - 点击右上角 **"Log In"** 或 **"Sign In"**

2. **登录账号**
   - 使用你的账号登录（GitHub、GitLab 或邮箱）

---

### 步骤 2：进入项目设置

1. **选择项目**
   - 在顶部导航栏，点击项目选择器
   - 选择项目：**`life-design`**
   - 或直接访问：https://vercel.com/yaoyao7ai/life-design

2. **进入设置页面**
   - 点击顶部导航栏的 **"Settings"** 标签
   - 或直接访问：https://vercel.com/yaoyao7ai/life-design/settings

---

### 步骤 3：添加环境变量

1. **找到环境变量设置**
   - 在左侧菜单中，找到并点击 **"Environment Variables"**
   - 或直接访问：https://vercel.com/yaoyao7ai/life-design/settings/environment-variables

2. **添加新环境变量**
   - 点击页面上的 **"Add New"** 按钮（通常在右上角或环境变量列表上方）

3. **填写环境变量信息**
   
   **Key（键名）：**
   ```
   VITE_API_BASE_URL
   ```
   ⚠️ **注意：** 必须完全一致，区分大小写！

   **Value（值）：**
   ```
   http://123.56.17.118:3000/api
   ```
   ⚠️ **注意：** 这是后端 API 的地址，确保 IP 地址正确！

   **Environment（环境）：**
   - ✅ 勾选 **"Production"**（生产环境）
   - ✅ 勾选 **"Preview"**（预览环境）
   - ✅ 勾选 **"Development"**（开发环境）
   - 或者只勾选 **"Production"**（如果只需要生产环境）

4. **保存环境变量**
   - 点击 **"Save"** 按钮
   - 确认环境变量已添加到列表中

---

### 步骤 4：重新部署前端

**重要：** 添加或修改环境变量后，必须重新部署才能生效！

#### 方法 1：通过 Deployments 页面重新部署（推荐）

1. **进入 Deployments 页面**
   - 点击顶部导航栏的 **"Deployments"** 标签
   - 或直接访问：https://vercel.com/yaoyao7ai/life-design/deployments

2. **找到最新的部署**
   - 在部署列表中，找到最新的部署（通常是第一个）
   - 部署状态应该显示 **"Ready"**（绿色圆点）

3. **触发重新部署**
   - 点击部署右侧的 **"..."**（三个点）菜单
   - 选择 **"Redeploy"**
   - 确认重新部署

4. **等待部署完成**
   - 部署通常需要 1-3 分钟
   - 可以查看部署日志了解进度
   - 部署完成后，状态会显示 **"Ready"**

---

#### 方法 2：通过 Git 推送触发部署

1. **推送代码到 Git**
   ```bash
   git add .
   git commit -m "Update: Add environment variables"
   git push origin main
   ```

2. **Vercel 自动部署**
   - Vercel 会自动检测到代码推送
   - 自动触发新的部署
   - 使用新的环境变量构建

---

### 步骤 5：验证环境变量

1. **检查部署日志**
   - 进入 **"Deployments"** 页面
   - 点击最新的部署
   - 查看 **"Build Logs"**
   - 确认环境变量已加载（通常不会直接显示，但会使用）

2. **测试网站**
   - 访问：https://www.life-design.me/me
   - 打开浏览器开发者工具（F12）
   - 在控制台执行：
     ```javascript
     console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
     ```
   - 应该显示：`http://123.56.17.118:3000/api`

---

## 📋 环境变量配置检查清单

完成以下检查：

- [ ] **已登录 Vercel Dashboard**
- [ ] **已进入项目 `life-design`**
- [ ] **已进入 Settings → Environment Variables**
- [ ] **已添加环境变量：**
  - [ ] Key: `VITE_API_BASE_URL`
  - [ ] Value: `http://123.56.17.118:3000/api`
  - [ ] Environment: Production（至少勾选这个）
- [ ] **已保存环境变量**
- [ ] **已重新部署前端**
- [ ] **已验证环境变量生效**

---

## 🎯 配置示例

### 正确的配置

| Key | Value | Environment |
|-----|-------|-------------|
| `VITE_API_BASE_URL` | `http://123.56.17.118:3000/api` | Production, Preview, Development |

### 常见错误

❌ **错误 1：键名错误**
```
Key: vite_api_base_url  // ❌ 应该是 VITE_API_BASE_URL
```

❌ **错误 2：值错误**
```
Value: http://localhost:3000/api  // ❌ 生产环境不能用 localhost
```

❌ **错误 3：未选择环境**
```
Environment: (未选择)  // ❌ 必须至少选择 Production
```

---

## 🔍 验证步骤

### 1. 检查环境变量是否添加成功

**在 Vercel Dashboard：**
- 进入 Settings → Environment Variables
- 确认 `VITE_API_BASE_URL` 在列表中
- 确认值正确：`http://123.56.17.118:3000/api`

---

### 2. 检查部署是否使用新环境变量

**在浏览器控制台（F12 → Console）：**
```javascript
// 检查环境变量
console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);

// 应该显示：http://123.56.17.118:3000/api
```

**如果显示 `undefined`：**
- 环境变量未正确配置
- 或前端未重新部署

---

### 3. 测试 API 连接

**在浏览器控制台执行：**
```javascript
// 测试后端连接
fetch('http://123.56.17.118:3000/api/health')
  .then(r => r.json())
  .then(data => {
    console.log('✅ 后端连接正常:', data);
  })
  .catch(err => {
    console.error('❌ 后端连接失败:', err);
  });
```

---

## ⚠️ 重要提示

### 1. 环境变量命名规则

- ✅ **必须以 `VITE_` 开头**（Vite 的要求）
- ✅ 使用大写字母和下划线
- ✅ 示例：`VITE_API_BASE_URL`

### 2. 环境变量作用域

- **Production：** 生产环境（https://www.life-design.me）
- **Preview：** 预览环境（Pull Request 部署）
- **Development：** 开发环境（本地开发）

**建议：** 至少配置 Production 环境

### 3. 重新部署的重要性

- ⚠️ **添加或修改环境变量后，必须重新部署才能生效**
- ⚠️ 环境变量在构建时注入，不是运行时读取
- ⚠️ 如果不重新部署，前端仍使用旧的环境变量

---

## 🆘 常见问题

### Q1: 环境变量添加后，前端仍无法连接 API

**可能原因：**
1. 未重新部署前端
2. 环境变量值错误
3. 浏览器缓存问题

**解决：**
1. 确认已重新部署
2. 清除浏览器缓存（Cmd+Shift+R）
3. 检查环境变量值是否正确

---

### Q2: 如何确认环境变量已生效？

**方法 1：查看构建日志**
- 进入 Deployments → 最新部署 → Build Logs
- 查找环境变量相关的日志（通常不会直接显示）

**方法 2：浏览器控制台**
```javascript
console.log(import.meta.env.VITE_API_BASE_URL);
```

---

### Q3: 可以添加多个环境变量吗？

**可以！** 可以添加多个环境变量，例如：
- `VITE_API_BASE_URL`
- `VITE_APP_NAME`
- `VITE_APP_VERSION`

---

## 📝 总结

**操作步骤：**
1. ✅ 登录 Vercel Dashboard
2. ✅ 进入项目 Settings → Environment Variables
3. ✅ 添加环境变量：`VITE_API_BASE_URL` = `http://123.56.17.118:3000/api`
4. ✅ 选择环境：Production（至少）
5. ✅ 保存环境变量
6. ✅ 重新部署前端
7. ✅ 验证环境变量生效

**完成这些步骤后，前端应该能够正确连接到后端 API！** ✅



