# 🚀 在服务器上更新 auth.js

## ✅ 已修复

**我已经修复了 `src/routes/auth.js`，将登录路由中的 `pool.query()` 改为使用 `getConnection()` 方式。**

---

## 🚀 在服务器上执行以下命令

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 备份原文件 ===" && \
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S) && \
echo "✅ 备份完成" && \
echo "" && \
echo "=== 2. 更新 auth.js（只修改登录路由）===" && \
# 读取原文件，找到登录路由部分并替换
sed -i '/router.post("\/login"/,/^});$/ {
  /try {/,/} catch (err) {/ {
    /查用户是否存在/ {
      a\
    // 获取连接\
    const connection = await pool.getConnection();\
    console.log('\''[登录] 获取连接成功'\'');\
    \
    try {\
      // 查用户是否存在
      d
    }
  }
}' src/routes/auth.js

# 实际上，sed 太复杂了，让我直接提供完整的替换命令
# 先查看需要修改的行号
echo "查找需要修改的行号："
grep -n "查用户是否存在" src/routes/auth.js
```

---

## 🎯 更简单的方法：直接替换登录路由部分

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 备份
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)

# 查看当前代码（第 73-102 行）
sed -n '73,102p' src/routes/auth.js

# 然后手动编辑，或者使用下面的完整替换
```

---

## 📋 或者：手动编辑文件

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend
nano src/routes/auth.js
```

**找到第 73-102 行，将：**

```javascript
  try {
    // 查用户是否存在
    const [rows] = await pool.query("SELECT * FROM users WHERE phone = ?", [phone]);

    let userId;

    if (rows.length === 0) {
      // 创建新用户
      const [result] = await pool.query("INSERT INTO users (phone) VALUES (?)", [phone]);
      userId = result.insertId;
    } else {
      userId = rows[0].id;
    }

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
  } catch (err) {
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
```

**保存文件（Ctrl+O, Enter, Ctrl+X），然后重启服务：**

```bash
pm2 restart life-design-backend --update-env
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

**现在在服务器上手动编辑文件，或者告诉我你希望我用其他方式帮你更新！** 🚀

