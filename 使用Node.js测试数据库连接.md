# 🧪 使用 Node.js 测试数据库连接

## ❌ 问题

**服务器上没有安装 mysql 客户端，无法直接测试。**

**但我们可以使用 Node.js 测试数据库连接！**

---

## 🧪 测试步骤

### 步骤 1：使用 Node.js 测试数据库连接

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 使用 Node.js 测试数据库连接
node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    console.log('=== 测试数据库连接 ===');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('');
    
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectionLimit: 1,
      connectTimeout: 5000
    });
    
    console.log('正在连接数据库...');
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功！');
    
    const [rows] = await connection.query('SELECT 1 as test');
    console.log('✅ 查询成功:', rows);
    
    connection.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    console.error('完整错误:', error);
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
node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  try {
    console.log('=== 测试数据库连接 ===');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('');
    
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectionLimit: 1,
      connectTimeout: 5000
    });
    
    console.log('正在连接数据库...');
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功！');
    
    const [rows] = await connection.query('SELECT 1 as test');
    console.log('✅ 查询成功:', rows);
    
    connection.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('');
      console.error('💡 连接超时可能的原因:');
      console.error('1. 白名单未配置（后端服务器 IP 不在白名单中）');
      console.error('2. 使用了外网地址但未开通外网');
      console.error('3. 网络不通');
    }
    process.exit(1);
  }
})();
"
```

---

## ✅ 根据测试结果处理

### 如果连接成功：
- ✅ 说明网络和配置都正确
- ✅ 问题可能在后端代码的其他地方
- ✅ 需要进一步检查代码

---

### 如果连接失败（ETIMEDOUT）：
**可能的原因：**
1. **白名单未配置**（最可能）
   - 在 RDS 控制台添加后端服务器 IP：`123.56.17.118`
2. **使用了外网地址但未开通外网**
   - 检查是否应该使用内网地址
3. **网络不通**
   - 检查 VPC 配置

---

## 📋 操作清单

- [ ] 使用 Node.js 测试数据库连接
- [ ] 根据错误信息判断问题
- [ ] 如果 ETIMEDOUT，检查白名单配置
- [ ] 如果连接成功，检查后端代码

---

**现在执行上面的测试命令！** 🚀

