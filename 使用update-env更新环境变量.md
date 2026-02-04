# 🔧 使用 --update-env 更新环境变量

## ❌ 问题

**配置已更新，但错误日志仍显示旧的数据库地址：**
```
Error: getaddrinfo ENOTFOUND rm-2zec076upfs3zd44110.mysql.rds.aliyuncs.com
```

**原因：**
- PM2 重启时可能没有重新加载环境变量
- 需要使用 `--update-env` 参数强制更新环境变量

---

## ✅ 解决方案

### 方法 1：使用 --update-env 重启（推荐）

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 使用 --update-env 重启，强制更新环境变量
pm2 restart life-design-backend --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

### 方法 2：完全停止并重新启动

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 停止服务
pm2 stop life-design-backend

# 删除进程
pm2 delete life-design-backend

# 重新启动（会读取新的环境变量）
cd /root/apps/life-design-backend
pm2 start src/server.js --name life-design-backend

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

## 🎯 快速修复命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 使用 --update-env 重启 ===" && \
pm2 restart life-design-backend --update-env && \
sleep 5 && \
echo "" && \
echo "=== 查看日志 ===" && \
pm2 logs life-design-backend --lines 30 --nostream
```

---

## ✅ 执行后检查

**配置更新后，日志应该显示：**
- ✅ 没有 `ENOTFOUND` 错误
- ✅ 没有数据库连接错误
- ✅ 服务正常运行
- ✅ 数据库连接成功

---

## 📋 操作清单

- [x] 配置已更新
- [ ] 使用 `--update-env` 重启服务
- [ ] 查看日志确认
- [ ] 测试登录功能

---

**现在执行上面的命令！** 🚀

