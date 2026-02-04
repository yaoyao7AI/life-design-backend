# 🔍 诊断 PM2 环境变量问题

## ❌ 问题

**现象：**
- ✅ 直接 Node.js 测试连接成功
- ✅ `.env` 文件配置正确
- ❌ PM2 运行的应用仍然报 `ETIMEDOUT`

**可能的原因：**
- PM2 进程可能没有正确加载 `.env` 文件
- 连接池创建时环境变量可能还没加载

---

## 🔍 诊断步骤

### 步骤 1：检查 PM2 进程实际使用的环境变量

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 检查 PM2 进程的环境变量
echo "=== PM2 进程环境变量 ==="
pm2 env 0 | grep -E "DB_HOST|DB_PORT|DB_USER|DB_NAME" || echo "无法获取环境变量"

# 检查代码中实际读取的环境变量
echo ""
echo "=== 代码中实际读取的环境变量 ==="
node -e "
require('dotenv').config();
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
"

# 检查 .env 文件内容
echo ""
echo "=== .env 文件内容 ==="
cat .env | grep -E "DB_HOST|DB_PORT|DB_USER|DB_NAME"
```

---

### 步骤 2：添加调试日志到代码中

**我已经更新了 `src/db.js`，添加了调试日志。**

**现在需要部署更新后的代码到服务器。**

---

### 步骤 3：重新部署并查看日志

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 1. 拉取最新代码（如果有 git）
# git pull

# 2. 或者直接上传更新后的 src/db.js
# （需要从本地上传）

# 3. 完全重启服务
pm2 stop life-design-backend
pm2 delete life-design-backend
pm2 save --force
sleep 3

# 4. 重新启动
pm2 start src/server.js --name life-design-backend --update-env

# 5. 查看启动日志，应该能看到 [DB] 开头的调试信息
sleep 3
pm2 logs life-design-backend --lines 50 --nostream | grep -E "\[DB\]|DB_HOST|ETIMEDOUT"
```

---

## 🎯 一键诊断命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 检查 .env 文件 ===" && \
cat .env | grep -E "DB_HOST|DB_PORT|DB_USER|DB_NAME" && \
echo "" && \
echo "=== 2. 检查代码中实际读取的环境变量 ===" && \
node -e "
require('dotenv').config();
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
" && \
echo "" && \
echo "=== 3. 检查 PM2 进程环境变量 ===" && \
pm2 env 0 2>/dev/null | grep -E "DB_HOST|DB_PORT|DB_USER|DB_NAME" || echo "无法获取 PM2 环境变量" && \
echo "" && \
echo "=== 4. 查看最近的日志（查找 [DB] 调试信息）===" && \
pm2 logs life-design-backend --lines 50 --nostream | tail -20
```

---

## ✅ 解决方案：部署更新后的代码

**我已经更新了 `src/db.js`，添加了调试日志。**

**现在需要将更新后的文件部署到服务器：**

### 方法 1：使用 SCP 上传（推荐）

**在本地执行：**

```bash
# 从本地上传更新后的 db.js 到服务器
scp src/db.js root@123.56.17.118:/root/apps/life-design-backend/src/db.js
```

### 方法 2：在服务器上直接编辑

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 备份原文件
cp src/db.js src/db.js.backup

# 编辑文件，添加调试日志
cat > src/db.js << 'EOF'
import mysql from "mysql2/promise";
import dotenv from "dotenv";

// 确保环境变量已加载（server.js 已经加载，这里再次确保）
dotenv.config();

// 添加调试日志，确认环境变量是否正确加载
console.log('[DB] 创建连接池，DB_HOST:', process.env.DB_HOST);
console.log('[DB] DB_PORT:', process.env.DB_PORT);
console.log('[DB] DB_USER:', process.env.DB_USER);
console.log('[DB] DB_NAME:', process.env.DB_NAME);

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  connectTimeout: 10000, // 添加连接超时设置
});
EOF

# 重启服务
pm2 stop life-design-backend
pm2 delete life-design-backend
pm2 save --force
sleep 3
pm2 start src/server.js --name life-design-backend --update-env
sleep 5
pm2 logs life-design-backend --lines 50 --nostream
```

---

## 📋 操作清单

- [ ] 执行诊断命令，检查环境变量
- [ ] 部署更新后的 `src/db.js`（包含调试日志）
- [ ] 重启服务并查看日志
- [ ] 根据日志中的 `[DB]` 信息确认环境变量是否正确

---

**现在先执行诊断命令，然后部署更新后的代码！** 🚀

