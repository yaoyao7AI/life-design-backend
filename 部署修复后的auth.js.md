# 🚀 部署修复后的 auth.js

## ✅ 已修复

**我已经修改了 `src/routes/auth.js`，将登录路由中的 `pool.query()` 改为使用 `getConnection()` 方式：**

- ✅ 先获取连接
- ✅ 使用连接查询
- ✅ 查询完成后释放连接
- ✅ 添加错误处理，确保连接被释放

---

## 🚀 部署步骤

### 在服务器上执行：

```bash
cd /root/apps/life-design-backend

# 备份原文件
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)

# 使用 SCP 从本地上传（推荐）
# 或者直接在服务器上编辑

# 重启服务
pm2 restart life-design-backend --update-env
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

## 🎯 使用 SCP 上传（推荐）

**在本地执行：**

```bash
# 从本地上传修复后的 auth.js
scp src/routes/auth.js root@123.56.17.118:/root/apps/life-design-backend/src/routes/auth.js

# 然后在服务器上重启
ssh root@123.56.17.118 "cd /root/apps/life-design-backend && pm2 restart life-design-backend --update-env"
```

---

## 📋 操作清单

- [x] 修复 auth.js，改用 getConnection() 方式
- [ ] 部署修复后的文件到服务器
- [ ] 重启服务并测试
- [ ] 测试登录功能

---

**现在需要将修复后的 `src/routes/auth.js` 部署到服务器！** 🚀

