# 🔧 删除 PM2 缓存并重新启动

## ❌ 问题

**`pm2 resurrect` 恢复了旧的进程配置！**

**错误信息：**
```
[PM2] [ERROR] Script already launched, add -f option to force re-execution
Error: getaddrinfo ENOTFOUND rm-2zec076upfs3zd4411o.mysql.rds.aliyuncs.com
```

**说明 PM2 的 dump 文件中保存了旧的配置！**

---

## ✅ 解决方案：删除 PM2 dump 文件

### 步骤 1：停止所有进程并删除 dump 文件

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 停止所有进程
pm2 stop all
pm2 delete all

# 删除 PM2 dump 文件（这会删除保存的进程配置）
rm -f /root/.pm2/dump.pm2

# 确认 dump 文件已删除
ls -la /root/.pm2/dump.pm2 2>/dev/null || echo "✅ dump 文件已删除"
```

---

### 步骤 2：重新启动进程

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 确认配置正确
cat .env | grep DB_HOST

# 重新启动（会读取新的环境变量）
pm2 start src/server.js --name life-design-backend --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 20 --nostream
```

---

## 🎯 一键修复命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 停止所有进程 ===" && \
pm2 stop all && \
pm2 delete all && \
echo "✅ 所有进程已删除" && \
echo "" && \
echo "=== 2. 删除 PM2 dump 文件 ===" && \
rm -f /root/.pm2/dump.pm2 && \
ls -la /root/.pm2/dump.pm2 2>/dev/null || echo "✅ dump 文件已删除" && \
echo "" && \
echo "=== 3. 确认配置 ===" && \
cat .env | grep DB_HOST && \
echo "" && \
echo "=== 4. 重新启动 ===" && \
pm2 start src/server.js --name life-design-backend --update-env && \
sleep 5 && \
echo "" && \
echo "=== 5. 查看日志 ===" && \
pm2 logs life-design-backend --lines 20 --nostream
```

---

## ✅ 执行后检查

**重启后，日志应该显示：**
- ✅ 没有 `ENOTFOUND` 错误
- ✅ 没有数据库连接错误
- ✅ 服务正常运行
- ✅ 数据库连接成功

---

## 📋 操作清单

- [ ] 停止所有进程
- [ ] 删除所有进程
- [ ] 删除 PM2 dump 文件
- [ ] 确认配置正确
- [ ] 重新启动进程
- [ ] 查看日志确认

---

**现在执行上面的命令，删除 dump 文件并重新启动！** 🚀

