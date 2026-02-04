# 🔍 检查 PM2 环境变量并修复

## ✅ 检查结果

- ✅ **代码配置正确：** `auth.js` 使用 `src/db.js`
- ✅ **.env 文件正确：** `DB_HOST=rm-2ze0yppdih8t4t4e4.mysql.rds.aliyuncs.com`
- ✅ **代码中没有硬编码地址**
- ❌ **但错误日志仍显示旧地址**

**说明 PM2 进程可能缓存了旧的环境变量！**

---

## 🔍 检查 PM2 环境变量

### 在服务器上执行：

```bash
cd /root/apps/life-design-backend

# 检查 PM2 进程的环境变量
pm2 env 0

# 或者只查看数据库相关的环境变量
pm2 env 0 | grep -E "DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME"
```

---

## ✅ 解决方案：强制更新环境变量

### 方法 1：使用 --update-env 并清除缓存

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 停止进程
pm2 stop life-design-backend

# 删除进程
pm2 delete life-design-backend

# 清除 PM2 缓存
pm2 kill
pm2 resurrect

# 重新启动（会读取新的环境变量）
pm2 start src/server.js --name life-design-backend --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 20 --nostream
```

---

### 方法 2：直接在启动时指定环境变量

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 停止并删除进程
pm2 stop life-design-backend
pm2 delete life-design-backend

# 重新启动，并明确指定环境变量文件
pm2 start src/server.js --name life-design-backend --update-env --env production

# 或者直接加载 .env 文件
NODE_ENV=production pm2 start src/server.js --name life-design-backend --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 20 --nostream
```

---

### 方法 3：检查 dotenv 加载顺序

**可能 `dotenv.config()` 在代码中执行太晚，需要确保在数据库连接之前加载。**

**检查 `src/server.js`：**

```bash
cd /root/apps/life-design-backend
head -20 src/server.js
```

**确保 `dotenv.config()` 在最开始执行！**

---

## 🎯 一键修复命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 检查 PM2 环境变量 ===" && \
pm2 env 0 | grep -E "DB_HOST|DB_PORT|DB_USER|DB_PASS|DB_NAME" && \
echo "" && \
echo "=== 2. 检查 server.js 中 dotenv 加载 ===" && \
head -20 src/server.js | grep -E "dotenv|require.*dotenv|import.*dotenv" && \
echo "" && \
echo "=== 3. 停止并删除进程 ===" && \
pm2 stop life-design-backend && \
pm2 delete life-design-backend && \
echo "✅ 进程已删除" && \
echo "" && \
echo "=== 4. 重新启动 ===" && \
pm2 start src/server.js --name life-design-backend --update-env && \
sleep 5 && \
echo "" && \
echo "=== 5. 查看日志 ===" && \
pm2 logs life-design-backend --lines 20 --nostream
```

---

## 📋 操作清单

- [ ] 检查 PM2 环境变量
- [ ] 检查 server.js 中 dotenv 加载顺序
- [ ] 停止并删除进程
- [ ] 重新启动进程
- [ ] 查看日志确认

---

**现在执行上面的检查命令！** 🔍

