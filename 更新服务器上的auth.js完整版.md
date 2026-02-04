# 🚀 更新服务器上的 auth.js（完整版）

## ❌ 问题

**服务器上的文件可能还没有完全更新，日志中没有看到调试信息。**

---

## 🚀 在服务器上执行完整更新

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend

# 备份
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)

# 检查当前第 73-80 行
echo "=== 当前代码 ==="
sed -n '73,80p' src/routes/auth.js

# 使用 sed 替换（如果第 75 行是 getConnection）
# 在第 75 行之前添加调试日志
sed -i '75i\    console.log('\''[登录] 开始获取连接...'\'');' src/routes/auth.js

# 在第 76 行之后添加成功日志（如果还没有）
sed -i '77a\    console.log('\''[登录] ✅ 获取连接成功'\'');' src/routes/auth.js 2>/dev/null || true

# 验证修改
echo ""
echo "=== 修改后的代码 ==="
sed -n '73,80p' src/routes/auth.js

# 重启服务
echo ""
echo "=== 重启服务 ==="
pm2 restart life-design-backend --update-env
sleep 5
pm2 logs life-design-backend --lines 30 --nostream | grep -E "\[登录\]|ETIMEDOUT"
```

---

## 📋 或者：手动编辑（更可靠）

**如果上面的 sed 命令不工作，手动编辑：**

```bash
cd /root/apps/life-design-backend
nano src/routes/auth.js
```

**找到第 73 行的 `try {`，确保第 75 行之前有：**

```javascript
    console.log('[登录] 开始获取连接...');
```

**确保第 76 行之后有：**

```javascript
    console.log('[登录] ✅ 获取连接成功');
```

**保存并重启服务。**

---

**现在执行上面的命令，更新文件并重启服务！** 🚀

