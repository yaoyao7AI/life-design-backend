# 🔍 找到 PM2 项目路径并更新配置

## ✅ 当前状态

- ✅ **当前目录的配置已正确：** `DB_HOST=rm-2ze0yppdih8t4t4e4.mysql.rds.aliyuncs.com`
- ❌ **但是 `/root/life-design-backend` 目录不存在**
- ❓ **需要找到 PM2 实际运行的项目路径**

---

## 🔍 步骤 1：检查 PM2 进程信息

**在服务器上执行：**

```bash
pm2 show life-design-backend
```

**或者：**

```bash
pm2 describe life-design-backend
```

**查找以下信息：**
- `script path` - 启动脚本路径
- `exec cwd` - 执行目录
- `error log path` - 错误日志路径（从日志路径可以推断项目目录）

---

## 🔍 步骤 2：检查日志路径

**从之前的日志看，路径是：**
```
/root/apps/life-design-backend/node_modules/...
```

**说明项目可能在：** `/root/apps/life-design-backend`

**检查这个目录：**

```bash
cd /root/apps/life-design-backend
pwd
ls -la
cat .env
```

---

## ✅ 步骤 3：更新正确的项目目录配置

**如果项目在 `/root/apps/life-design-backend`：**

```bash
cd /root/apps/life-design-backend

# 备份
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# 更新配置
cat > .env << 'EOF'
DB_HOST=rm-2ze0yppdih8t4t4e4.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=life_design_user
DB_PASS=YOUR_DB_PASSWORD
DB_NAME=life_design
EOF

# 验证
cat .env

# 重启
pm2 restart life-design-backend

# 查看日志
sleep 5
pm2 logs life-design-backend --lines 20 --nostream
```

---

## 🎯 一键排查命令

**复制以下全部命令，一次性执行：**

```bash
echo "=== PM2 进程信息 ===" && \
pm2 show life-design-backend && \
echo "" && \
echo "=== 检查 /root/apps/life-design-backend ===" && \
if [ -d /root/apps/life-design-backend ]; then \
  cd /root/apps/life-design-backend && \
  echo "目录存在，当前目录：$(pwd)" && \
  echo "" && \
  echo "=== 当前 .env 内容 ===" && \
  cat .env; \
else \
  echo "目录不存在"; \
fi
```

---

## 📋 操作清单

- [ ] 检查 PM2 进程信息
- [ ] 找到实际的项目目录
- [ ] 检查该目录的 .env 文件
- [ ] 更新配置（如果需要）
- [ ] 重启后端服务
- [ ] 查看日志确认

---

**现在执行上面的排查命令！** 🔍

