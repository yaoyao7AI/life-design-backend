# 🔧 修复 PM2 启动问题

## ❌ 问题分析

**现象：**
- ✅ 直接测试数据库连接成功
- ❌ PM2 启动的服务仍然报 `ETIMEDOUT`
- ⚠️ PM2 启动命令：`pm2 start npm --name life-design-backend -- start`

**原因：**
- PM2 启动 `npm` 时，工作目录可能不正确
- `dotenv.config()` 找不到 `.env` 文件
- 环境变量没有正确加载

---

## ✅ 解决方案：使用正确的 PM2 启动方式

### 方法 1：直接启动 server.js（推荐）

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 停止并删除进程
pm2 stop life-design-backend 2>/dev/null || true
pm2 delete life-design-backend 2>/dev/null || true

# 直接启动 server.js（确保工作目录正确）
pm2 start src/server.js --name life-design-backend --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

### 方法 2：指定工作目录启动 npm

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 停止并删除进程
pm2 stop life-design-backend 2>/dev/null || true
pm2 delete life-design-backend 2>/dev/null || true

# 指定工作目录启动 npm
pm2 start npm --name life-design-backend --cwd /root/apps/life-design-backend -- start --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

### 方法 3：创建 PM2 配置文件（最可靠）

**创建 `ecosystem.config.js` 文件：**

```bash
cd /root/apps/life-design-backend

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'life-design-backend',
    script: 'src/server.js',
    cwd: '/root/apps/life-design-backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '/root/.pm2/logs/life-design-backend-error.log',
    out_file: '/root/.pm2/logs/life-design-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G'
  }]
};
EOF

# 停止并删除进程
pm2 stop life-design-backend 2>/dev/null || true
pm2 delete life-design-backend 2>/dev/null || true

# 使用配置文件启动
pm2 start ecosystem.config.js

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

## 🎯 一键修复命令（推荐方法 1）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 停止并删除进程 ===" && \
pm2 stop life-design-backend 2>/dev/null || true && \
pm2 delete life-design-backend 2>/dev/null || true && \
echo "✅ 进程已删除" && \
echo "" && \
echo "=== 2. 确认配置 ===" && \
echo "当前目录: $(pwd)" && \
echo "DB_HOST: $(grep DB_HOST .env | cut -d'=' -f2)" && \
echo "" && \
echo "=== 3. 直接启动 server.js ===" && \
pm2 start src/server.js --name life-design-backend --update-env && \
sleep 5 && \
echo "" && \
echo "=== 4. 查看日志 ===" && \
pm2 logs life-design-backend --lines 30 --nostream
```

---

## 🔍 验证环境变量是否正确加载

**启动后，检查环境变量：**

```bash
# 检查 PM2 进程的环境变量
pm2 env 0 | grep DB_HOST

# 或者在代码中添加调试日志
# 检查 src/db.js 是否正确加载了环境变量
```

---

## 📋 操作清单

- [ ] 停止并删除旧的 PM2 进程
- [ ] 使用正确的方式启动（直接启动 `src/server.js`）
- [ ] 确认环境变量正确加载
- [ ] 查看日志确认没有错误
- [ ] 测试登录功能

---

**现在执行上面的修复命令！** 🚀

