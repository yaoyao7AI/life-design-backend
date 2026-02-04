# 🔍 测试 MySQL 连接和认证

## ❌ 问题分析

**现象：**
- ✅ 端口 3306 可达（TCP 连接成功）
- ✅ 连接池配置正确
- ✅ 环境变量正确
- ❌ 但应用仍然报 `ETIMEDOUT`

**可能的原因：**
- MySQL 认证问题
- 连接池在第一次查询时才连接，此时超时
- 需要在连接池创建时测试连接

---

## 🧪 测试 MySQL 连接

### 步骤 1：使用 Node.js 测试完整连接（包括认证）

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    console.log('=== 测试 MySQL 连接（包括认证）===');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('');
    
    // 创建单个连接（不使用连接池）
    console.log('正在创建连接...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectTimeout: 30000
    });
    
    console.log('✅ 连接创建成功！');
    
    // 测试查询
    console.log('正在执行查询...');
    const [rows] = await connection.query('SELECT DATABASE() as db, NOW() as time, USER() as user');
    console.log('✅ 查询成功！');
    console.log('当前数据库:', rows[0].db);
    console.log('当前用户:', rows[0].user);
    console.log('服务器时间:', rows[0].time);
    
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 连接失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    console.error('错误编号:', error.errno);
    if (error.code === 'ETIMEDOUT') {
      console.error('');
      console.error('💡 连接超时可能的原因:');
      console.error('1. MySQL 用户权限问题');
      console.error('2. 数据库不存在');
      console.error('3. 密码错误');
      console.error('4. 网络路由问题');
    }
    process.exit(1);
  }
})();
"
```

---

### 步骤 2：测试连接池连接

**如果单个连接成功，测试连接池：**

```bash
cd /root/apps/life-design-backend

node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    console.log('=== 测试连接池连接 ===');
    
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectionLimit: 1,
      connectTimeout: 30000,
      acquireTimeout: 30000,
      timeout: 30000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    });
    
    console.log('正在从连接池获取连接...');
    const connection = await pool.getConnection();
    console.log('✅ 从连接池获取连接成功！');
    
    const [rows] = await connection.query('SELECT DATABASE() as db');
    console.log('✅ 查询成功，当前数据库:', rows[0].db);
    
    connection.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 连接池连接失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    process.exit(1);
  }
})();
"
```

---

## 🎯 一键测试命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 测试单个 MySQL 连接（包括认证）===" && \
node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
  try {
    console.log('正在创建连接...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectTimeout: 30000
    });
    console.log('✅ 连接创建成功！');
    const [rows] = await connection.query('SELECT DATABASE() as db, NOW() as time');
    console.log('✅ 查询成功，当前数据库:', rows[0].db);
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 连接失败:', error.code, error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('');
      console.error('💡 可能的原因:');
      console.error('1. MySQL 用户权限问题');
      console.error('2. 数据库不存在');
      console.error('3. 密码错误');
    }
    process.exit(1);
  }
})();
" && \
if [ $? -eq 0 ]; then
  echo "" && \
  echo "=== 2. 测试连接池连接 ===" && \
  node -e "
  const mysql = require('mysql2/promise');
  require('dotenv').config();
  (async () => {
    try {
      const pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        connectionLimit: 1,
        connectTimeout: 30000,
        acquireTimeout: 30000,
        timeout: 30000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });
      const connection = await pool.getConnection();
      console.log('✅ 从连接池获取连接成功！');
      const [rows] = await connection.query('SELECT DATABASE() as db');
      console.log('✅ 查询成功，当前数据库:', rows[0].db);
      connection.release();
      await pool.end();
      process.exit(0);
    } catch (error) {
      console.error('❌ 连接池连接失败:', error.code, error.message);
      process.exit(1);
    }
  })();
  "
fi
```

---

## 💡 如果单个连接成功但连接池失败

**可能需要在连接池创建时立即测试连接。**

**修改 `src/db.js`，在创建连接池后立即测试：**

```javascript
// 创建连接池后立即测试连接
pool.getConnection()
  .then(connection => {
    console.log('[DB] ✅ 连接池连接测试成功');
    connection.release();
  })
  .catch(error => {
    console.error('[DB] ❌ 连接池连接测试失败:', error.code, error.message);
  });
```

---

## 📋 操作清单

- [ ] 测试单个 MySQL 连接（包括认证）
- [ ] 如果成功，测试连接池连接
- [ ] 根据测试结果继续排查

---

**现在执行上面的测试命令！** 🚀

