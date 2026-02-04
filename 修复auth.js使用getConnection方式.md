# 🔧 修复 auth.js 使用 getConnection 方式

## ❌ 问题分析

**现象：**
- ✅ 连接池创建时测试成功
- ❌ 但使用 `pool.query()` 查询时失败

**可能的原因：**
- `pool.query()` 可能在获取连接时有问题
- 改用 `getConnection()` 方式可能更可靠

---

## 🔧 修复方案

**修改 `src/routes/auth.js`，将 `pool.query()` 改为使用 `getConnection()` 方式：**

```javascript
// 原来的方式
const [rows] = await pool.query("SELECT * FROM users WHERE phone = ?", [phone]);

// 改为
const connection = await pool.getConnection();
try {
  const [rows] = await connection.query("SELECT * FROM users WHERE phone = ?", [phone]);
  // ... 使用 rows
} finally {
  connection.release();
}
```

---

## 🚀 部署步骤

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 备份原文件
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)

# 查看需要修改的地方
grep -n "pool.query" src/routes/auth.js
```

---

**但是，修改所有 `pool.query()` 调用可能比较复杂。**

**让我先尝试另一个方法：检查连接池的连接是否真的可用。**

---

## 🧪 先测试：在查询前获取连接

**修改 `auth.js` 的登录路由，在查询前先获取连接：**

```javascript
try {
  // 先获取连接，测试连接是否可用
  const connection = await pool.getConnection();
  console.log('[登录] 获取连接成功');
  
  // 使用连接查询
  const [rows] = await connection.query("SELECT * FROM users WHERE phone = ?", [phone]);
  connection.release();
  
  // ... 后续代码
} catch (err) {
  console.error("[登录错误]", err);
  res.status(500).json({ error: "登录失败" });
}
```

---

**让我创建一个测试版本，只修改登录路由。**

