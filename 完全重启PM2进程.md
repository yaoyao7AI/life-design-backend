# 🔄 完全重启 PM2 进程

## ❌ 问题

**即使使用了 `--update-env`，错误日志仍然显示旧的数据库地址：**
```
Error: getaddrinfo ENOTFOUND rm-2zec076upfs3zd44110.mysql.rds.aliyuncs.com
```

**可能的原因：**
- PM2 缓存了环境变量
- 需要完全停止并删除进程，然后重新启动

---

## ✅ 解决方案：完全重启

### 步骤 1：停止并删除进程

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 停止进程
pm2 stop life-design-backend

# 删除进程
pm2 delete life-design-backend

# 确认已删除
pm2 list
```

---

### 步骤 2：重新启动进程

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 确认 .env 文件内容
cat .env | grep DB_HOST

# 重新启动（会读取新的环境变量）
pm2 start src/server.js --name life-design-backend

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

## 🎯 一键重启命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 停止并删除进程 ===" && \
pm2 stop life-design-backend && \
pm2 delete life-design-backend && \
echo "✅ 进程已删除" && \
echo "" && \
echo "=== 确认配置 ===" && \
cat .env | grep DB_HOST && \
echo "" && \
echo "=== 重新启动 ===" && \
pm2 start src/server.js --name life-design-backend && \
sleep 5 && \
echo "" && \
echo "=== 查看日志 ===" && \
pm2 logs life-design-backend --lines 30 --nostream
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

- [ ] 停止进程
- [ ] 删除进程
- [ ] 确认配置正确
- [ ] 重新启动进程
- [ ] 查看日志确认

---

**现在执行上面的命令，完全重启进程！** 🚀

