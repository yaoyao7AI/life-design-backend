# ✅ CORS 配置最终修复

## 🔧 已更新的配置

### CORS 配置（开发环境）

**文件：** `src/app.js`

**当前配置：**
```javascript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [
        'http://localhost:5173',
        'https://your-frontend-domain.com',
      ]
    : '*',  // 开发环境允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
```

---

## ✅ 配置说明

### 开发环境（默认）
- `origin: '*'` - 允许所有来源访问
- 方便本地开发和调试
- 支持任何前端端口和域名

### 生产环境
- 需要设置 `NODE_ENV=production`
- 只允许指定的域名访问
- 更安全

---

## 🚀 服务器部署步骤

### 1. 确保代码已更新

在服务器上执行：
```bash
cd /root/apps/life-design-backend
git pull  # 或手动更新文件
```

### 2. 确认 CORS 已安装

```bash
npm list cors
```

如果没有，安装：
```bash
npm install cors
```

### 3. 确认 app.js 配置正确

检查 `src/app.js` 文件，确保包含 CORS 配置。

### 4. 重启服务器

```bash
pm2 restart life-design-backend
```

或

```bash
pm2 restart all
```

### 5. 查看日志确认

```bash
pm2 logs life-design-backend
```

---

## 🧪 测试 CORS

### 测试预检请求

```bash
curl -X OPTIONS http://123.56.17.118:3000/api/auth/send-code \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

**应该看到：**
```
< Access-Control-Allow-Origin: *
< Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS,PATCH
< Access-Control-Allow-Headers: Content-Type,Authorization,X-Requested-With
< Access-Control-Allow-Credentials: true
```

### 测试实际请求

```bash
curl -X POST http://123.56.17.118:3000/api/auth/send-code \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"phone":"13133273452"}'
```

---

## ⚠️ 如果仍然报错

### 检查清单

1. **服务器代码已更新**
   ```bash
   cat src/app.js | grep -A 10 "CORS"
   ```

2. **服务器已重启**
   ```bash
   pm2 list
   pm2 restart life-design-backend
   ```

3. **CORS 包已安装**
   ```bash
   npm list cors
   ```

4. **检查服务器日志**
   ```bash
   pm2 logs life-design-backend --lines 50
   ```

5. **清除浏览器缓存**
   - 按 `Ctrl+Shift+R` 强制刷新
   - 或使用无痕模式

---

## 🔒 生产环境安全配置

### 推荐配置（生产环境）

编辑 `.env` 文件：
```env
NODE_ENV=production
```

然后修改 `src/app.js`：
```javascript
app.use(cors({
  origin: [
    'https://your-frontend-domain.com',  // 生产环境前端域名
    'https://www.your-frontend-domain.com',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
```

---

## ✅ 完成状态

- ✅ CORS 包已安装
- ✅ CORS 配置已更新
- ✅ 开发环境允许所有来源
- ✅ 支持预检请求（OPTIONS）
- ✅ 服务器已重启（本地）

**下一步：**
1. 在服务器上更新代码
2. 重启服务器
3. 测试前端请求

CORS 配置已完全修复！🎉



