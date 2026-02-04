# 📋 前后端代码同步与部署流程指南

## 🎯 核心原则

### ✅ 前后端分离架构

你的项目是**前后端分离**架构：

```
前端（Frontend）
├── 位置：affirmation-mvp/frontend/
├── 技术栈：React + Vite
├── 部署：Vercel（自动部署）
└── 仓库：GitHub（可能独立仓库或 monorepo）

后端（Backend）
├── 位置：life-design-backend/
├── 技术栈：Node.js + Express
├── 部署：阿里云 ECS（手动部署）
└── 仓库：GitHub（可能独立仓库或 monorepo）
```

---

## 🔄 代码同步规则

### ❌ 不需要同步的情况

以下情况**不需要**前后端代码同步：

1. **纯前端功能更新**
   - UI 样式调整
   - 前端组件优化
   - 前端路由调整
   - **操作：** 只需更新前端代码，推送到 GitHub，Vercel 自动部署

2. **纯后端功能更新**
   - 数据库查询优化
   - 后端业务逻辑调整
   - 后端中间件更新
   - **操作：** 只需更新后端代码，部署到服务器，重启服务

3. **独立功能开发**
   - 前端新增页面（不调用新 API）
   - 后端新增工具函数（不暴露新接口）

---

### ✅ 需要同步的情况

以下情况**需要**前后端代码同步：

#### 1. API 接口变更（最常见）

**场景：** 后端新增、修改或删除 API 接口

**流程：**

```
后端更新 API
  ↓
前端更新 API 调用代码
  ↓
后端部署
  ↓
前端部署
```

**示例：**

**后端新增接口：**
```javascript
// 后端：src/routes/affirmations.js
router.get('/new-endpoint', async (req, res) => {
  res.json({ success: true, data: '新数据' });
});
```

**前端需要同步：**
```typescript
// 前端：src/api/affirmations.ts
export async function getNewData() {
  const res = await fetch(`${BASE_URL}/affirmations/new-endpoint`);
  return res.json();
}
```

**部署顺序：**
1. ✅ 先部署后端（确保接口可用）
2. ✅ 再部署前端（前端才能调用新接口）

---

#### 2. API 响应格式变更

**场景：** 后端修改了 API 返回的数据结构

**流程：**

```
后端更新响应格式
  ↓
前端更新数据处理逻辑
  ↓
后端部署
  ↓
前端部署
```

**示例：**

**后端修改响应：**
```javascript
// 之前：{ data: [...] }
// 现在：{ success: true, data: [...] }
```

**前端需要同步：**
```typescript
// 前端需要更新数据解析逻辑
const response = await fetch(...);
const result = await response.json();
// 之前：const data = result.data;
// 现在：const data = result.success ? result.data : [];
```

---

#### 3. 环境变量变更

**场景：** 后端或前端需要新的环境变量

**流程：**

```
更新环境变量配置
  ↓
后端：更新 .env 文件
  ↓
前端：更新 Vercel 环境变量
  ↓
重启服务/重新部署
```

**示例：**

**后端新增环境变量：**
```env
# .env
NEW_FEATURE_ENABLED=true
```

**前端可能需要同步：**
- 如果前端需要知道这个配置，需要在 Vercel 环境变量中添加
- 或者通过 API 返回给前端

---

#### 4. 数据库结构变更

**场景：** 后端修改了数据库表结构

**流程：**

```
更新数据库结构
  ↓
后端代码适配新结构
  ↓
前端可能需要适配（如果影响 API 响应）
  ↓
后端部署
  ↓
前端部署（如果需要）
```

**示例：**

**数据库新增字段：**
```sql
ALTER TABLE affirmations ADD COLUMN new_field VARCHAR(255);
```

**后端代码更新：**
```javascript
// 后端返回新字段
res.json({ id: 1, text: '...', new_field: '...' });
```

**前端可能需要更新：**
```typescript
// 前端类型定义
interface Affirmation {
  id: number;
  text: string;
  new_field?: string; // 新增字段
}
```

---

## 🚀 部署流程

### 前端部署流程（Vercel）

**特点：** 自动化部署，推送到 GitHub 后自动触发

**步骤：**

```bash
# 1. 更新前端代码
cd /Users/mac/Desktop/affirmation-mvp/frontend

# 2. 提交代码
git add .
git commit -m "feat: 更新前端功能"
git push origin main

# 3. Vercel 自动检测并部署
# - 进入 Vercel Dashboard
# - 查看 Deployments
# - 等待状态变为 "Ready"（通常 1-3 分钟）
```

**注意事项：**
- ✅ 不需要手动部署
- ✅ Vercel 会自动构建和部署
- ✅ 部署完成后自动生效

---

### 后端部署流程（阿里云 ECS）

**特点：** 手动部署，需要 SSH 连接到服务器

**步骤：**

```bash
# 1. 更新后端代码
cd /Users/mac/Desktop/life-design-backend

# 2. 提交代码（如果使用 Git）
git add .
git commit -m "feat: 更新后端功能"
git push origin main

# 3. 部署到服务器（方法 A：使用 Git）
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118
cd /root/apps/life-design-backend
git pull origin main
npm install  # 如果有新依赖
pm2 restart life-design-backend

# 或者方法 B：使用 SCP 同步文件
scp -i ~/Desktop/ssh-keys/life-design-key.pem \
  src/routes/affirmations.js \
  root@123.56.17.118:/root/apps/life-design-backend/src/routes/

# 然后重启服务
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118
pm2 restart life-design-backend
```

**注意事项：**
- ⚠️ 需要手动部署
- ⚠️ 需要重启服务才能生效
- ⚠️ 确保服务器上的代码是最新的

---

## 📋 常见场景处理

### 场景 1：后端新增 API 接口

**步骤：**

1. **后端开发**
   ```bash
   # 在本地开发并测试
   cd life-design-backend
   npm run dev
   # 测试新接口：curl http://localhost:3000/api/new-endpoint
   ```

2. **后端部署**
   ```bash
   # 部署到服务器
   git push origin main
   ssh root@123.56.17.118
   cd /root/apps/life-design-backend
   git pull
   pm2 restart life-design-backend
   ```

3. **前端开发**
   ```bash
   # 更新前端代码调用新接口
   cd affirmation-mvp/frontend
   # 在 src/api/ 中添加新的 API 调用函数
   ```

4. **前端部署**
   ```bash
   # 推送到 GitHub，Vercel 自动部署
   git push origin main
   ```

**关键点：**
- ✅ 先部署后端，确保接口可用
- ✅ 再部署前端，前端才能调用新接口

---

### 场景 2：前端修改 UI，不涉及 API

**步骤：**

1. **前端开发**
   ```bash
   cd affirmation-mvp/frontend
   # 修改 UI 组件
   ```

2. **前端部署**
   ```bash
   git push origin main
   # Vercel 自动部署，无需后端操作
   ```

**关键点：**
- ✅ 只更新前端代码
- ✅ 不需要后端同步
- ✅ 不需要后端部署

---

### 场景 3：后端修改业务逻辑，不改变 API

**步骤：**

1. **后端开发**
   ```bash
   cd life-design-backend
   # 修改业务逻辑
   ```

2. **后端部署**
   ```bash
   git push origin main
   ssh root@123.56.17.118
   cd /root/apps/life-design-backend
   git pull
   pm2 restart life-design-backend
   ```

**关键点：**
- ✅ 只更新后端代码
- ✅ 不需要前端同步
- ✅ 不需要前端部署

---

### 场景 4：API 响应格式变更

**步骤：**

1. **后端更新**
   ```bash
   # 修改 API 响应格式
   cd life-design-backend
   # 更新路由代码
   ```

2. **后端部署**
   ```bash
   git push origin main
   ssh root@123.56.17.118
   git pull
   pm2 restart life-design-backend
   ```

3. **前端更新**
   ```bash
   # 更新前端数据处理逻辑
   cd affirmation-mvp/frontend
   # 修改 API 调用代码，适配新格式
   ```

4. **前端部署**
   ```bash
   git push origin main
   # Vercel 自动部署
   ```

**关键点：**
- ⚠️ 先部署后端，再部署前端
- ⚠️ 前端必须适配新的响应格式
- ⚠️ 如果格式不兼容，前端会报错

---

## 🔍 检查清单

### 后端更新后，前端需要检查：

- [ ] API 接口路径是否变更？
- [ ] API 请求参数是否变更？
- [ ] API 响应格式是否变更？
- [ ] 是否需要新增前端 API 调用函数？
- [ ] 前端类型定义是否需要更新？

### 前端更新后，后端需要检查：

- [ ] 前端是否调用了新的 API？
- [ ] 前端是否修改了 API 调用方式？
- [ ] 是否需要后端提供新的接口？
- [ ] 是否需要后端修改现有接口？

---

## 💡 最佳实践

### 1. API 版本管理

**建议：** 使用 API 版本号

```javascript
// 后端：/api/v1/affirmations
// 前端：BASE_URL + '/v1/affirmations'
```

**优势：**
- ✅ 向后兼容
- ✅ 可以同时支持多个版本
- ✅ 升级更安全

---

### 2. 接口文档

**建议：** 维护 API 文档

```markdown
# API 文档

## GET /api/affirmations
- 请求参数：无
- 响应格式：{ success: true, data: [...] }
```

**优势：**
- ✅ 前后端协作更顺畅
- ✅ 减少沟通成本
- ✅ 避免接口理解偏差

---

### 3. 测试环境

**建议：** 使用测试环境

```
开发环境（本地）
  ↓
测试环境（staging）
  ↓
生产环境（production）
```

**优势：**
- ✅ 先测试再上线
- ✅ 减少生产环境错误
- ✅ 更安全的部署流程

---

### 4. 部署顺序

**建议：** 先部署后端，再部署前端

```
后端部署（确保接口可用）
  ↓
等待后端稳定（1-2 分钟）
  ↓
前端部署（前端调用后端）
```

**原因：**
- ✅ 避免前端调用不存在的接口
- ✅ 避免前端调用旧接口导致错误
- ✅ 更安全的部署流程

---

## 📝 总结

### ✅ 不需要同步的情况

- 纯前端功能更新
- 纯后端功能更新
- 独立功能开发

### ✅ 需要同步的情况

- API 接口变更
- API 响应格式变更
- 环境变量变更
- 数据库结构变更（如果影响 API）

### ✅ 部署顺序

1. **后端更新 API** → 先部署后端
2. **前端调用 API** → 再部署前端
3. **纯前端更新** → 只部署前端
4. **纯后端更新** → 只部署后端

---

## 🚀 快速参考

### 前端部署（Vercel）

```bash
cd affirmation-mvp/frontend
git add .
git commit -m "feat: 更新功能"
git push origin main
# Vercel 自动部署
```

### 后端部署（ECS）

```bash
cd life-design-backend
git add .
git commit -m "feat: 更新功能"
git push origin main

# SSH 到服务器
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118
cd /root/apps/life-design-backend
git pull origin main
npm install  # 如果有新依赖
pm2 restart life-design-backend
```

---

**记住：前后端分离架构的核心是「独立部署，通过 API 通信」！** 🎯



