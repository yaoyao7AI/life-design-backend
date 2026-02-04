# 🔍 检查并更新 auth.js

## ❌ 问题确认

**从日志看到：**
- 错误仍然在 `auth.js:75:31`，说明文件还没有更新
- 错误仍然是 `PromisePool.query`，说明还在使用 `pool.query()`
- 连接池测试成功：`[DB] ✅ 连接池连接测试成功`

**文件还没有更新！**

---

## 🔍 先检查当前文件内容

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 查看第 73-80 行的内容
sed -n '73,80p' src/routes/auth.js

# 如果看到 `pool.query`，说明文件还没有更新
```

---

## 🚀 更新文件（使用 sed 替换）

**在服务器上执行以下命令：**

```bash
cd /root/apps/life-design-backend

# 备份
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)

# 查看需要修改的行
echo "=== 当前第 73-102 行 ==="
sed -n '73,102p' src/routes/auth.js

# 使用 sed 替换（如果第 75 行是 pool.query）
# 注意：sed 替换多行比较复杂，建议手动编辑
```

---

## 📝 手动编辑（推荐）

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend
nano src/routes/auth.js
```

**找到第 73 行开始的 `try {` 块，将：**

```javascript
  try {
    // 查用户是否存在
    const [rows] = await pool.query("SELECT * FROM users WHERE phone = ?", [phone]);
```

**改为：**

```javascript
  try {
    // 获取连接
    const connection = await pool.getConnection();
    console.log('[登录] 获取连接成功');
    
    try {
      // 查用户是否存在
      const [rows] = await connection.query("SELECT * FROM users WHERE phone = ?", [phone]);
```

**然后找到第 81 行（创建新用户的地方），将：**

```javascript
      const [result] = await pool.query("INSERT INTO users (phone) VALUES (?)", [phone]);
```

**改为：**

```javascript
        const [result] = await connection.query("INSERT INTO users (phone) VALUES (?)", [phone]);
```

**然后找到 `userId = rows[0].id;` 之后，在生成 JWT token 之前，添加：**

```javascript
      }
      
      // 释放连接
      connection.release();

      // 生成 JWT token
```

**最后，找到 `res.json({` 之后，在 `} catch (err) {` 之前，添加：**

```javascript
      });
    } catch (queryErr) {
      // 如果查询出错，释放连接
      connection.release();
      throw queryErr;
    }
```

**保存文件（Ctrl+O, Enter, Ctrl+X）**

---

## 🎯 或者：使用完整的替换脚本

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 备份
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)

# 创建一个临时文件，包含修复后的代码片段
cat > /tmp/auth_login_fix.js << 'FIX_CODE'
  try {
    // 获取连接
    const connection = await pool.getConnection();
    console.log('[登录] 获取连接成功');
    
    try {
      // 查用户是否存在
      const [rows] = await connection.query("SELECT * FROM users WHERE phone = ?", [phone]);

      let userId;

      if (rows.length === 0) {
        // 创建新用户
        const [result] = await connection.query("INSERT INTO users (phone) VALUES (?)", [phone]);
        userId = result.insertId;
      } else {
        userId = rows[0].id;
      }
      
      // 释放连接
      connection.release();

      // 生成 JWT token
      const token = jwt.sign(
        { id: userId, phone },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      res.json({
        success: true,
        token,
        user: { id: userId, phone }
      });
    } catch (queryErr) {
      // 如果查询出错，释放连接
      connection.release();
      throw queryErr;
    }
  } catch (err) {
FIX_CODE

# 然后手动替换（或者告诉我你希望我提供更详细的步骤）
```

---

## ✅ 更新后重启

**更新文件后，执行：**

```bash
cd /root/apps/life-design-backend

# 验证修改
echo "=== 验证修改 ==="
grep -n "getConnection\|connection.query" src/routes/auth.js | head -5

# 重启服务
pm2 restart life-design-backend --update-env
sleep 5
pm2 logs life-design-backend --lines 30 --nostream | grep -E "\[登录\]|ETIMEDOUT|登录错误"
```

---

**现在先检查文件内容，然后手动编辑更新！** 🚀

