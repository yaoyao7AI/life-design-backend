# 🔧 修复 RDS 白名单配置

## ✅ 关键发现

**从ECS实例信息确认：**
- **公网IP：** `123.56.17.118`
- **私网IP：** `172.30.67.7`
- **VPC网段：** `172.16.0.0/12`
- **RDS内网地址：** `rm-2ze0yppdih8t4t4e4.mysql.rds.aliyuncs.com`

**问题：**
- ✅ 服务器和RDS在同一VPC（私网IP `172.30.67.7` 在 `172.16.0.0/12` 范围内）
- ✅ 应该使用内网地址连接
- ❌ **RDS白名单可能只添加了公网IP，需要添加私网IP！**

---

## 🔧 修复步骤

### 步骤 1：在阿里云 RDS 控制台添加私网IP到白名单

1. **进入 RDS 控制台**
2. **找到实例：** `rm-2ze0yppdih8t4t4e4`
3. **点击：** 数据安全性 → 白名单设置
4. **点击：** 修改
5. **添加以下IP到白名单：**
   - `172.30.67.7`（**服务器私网IP，必须添加！**）
   - `123.56.17.118`（公网IP，如果使用外网地址）
   - 或者添加整个VPC网段：`172.16.0.0/12`（推荐，更安全）
6. **点击：** 确定

---

### 步骤 2：确认使用内网地址

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 确认当前配置
echo "=== 当前配置 ==="
cat .env | grep DB_HOST

# 如果使用的是外网地址（带 vo），更新为内网地址
if grep -q "vo.mysql.rds" .env; then
  echo ""
  echo "⚠️  检测到外网地址，更新为内网地址..."
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  sed -i 's/rm-2ze0yppdih8t4t4e4vo\.mysql\.rds/rm-2ze0yppdih8t4t4e4.mysql.rds/g' .env
  echo "✅ 已更新为内网地址"
  cat .env | grep DB_HOST
fi
```

---

### 步骤 3：测试数据库连接

**在服务器上执行：**

```bash
cd /root/apps/life-design-backend

# 测试连接
node -e "
const mysql = require('mysql2/promise');
require('dotenv').config();
(async () => {
  try {
    console.log('=== 测试数据库连接 ===');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('服务器私网IP: 172.30.67.7');
    console.log('');
    
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      connectionLimit: 1,
      connectTimeout: 10000
    });
    
    console.log('正在连接数据库...');
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功！');
    
    const [rows] = await connection.query('SELECT DATABASE() as db, NOW() as time');
    console.log('✅ 当前数据库:', rows[0].db);
    console.log('✅ 连接时间:', rows[0].time);
    
    connection.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库连接失败:');
    console.error('错误代码:', error.code);
    console.error('错误信息:', error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('');
      console.error('💡 可能的原因:');
      console.error('1. RDS白名单未添加服务器私网IP: 172.30.67.7');
      console.error('2. 或者添加整个VPC网段: 172.16.0.0/12');
    }
    process.exit(1);
  }
})();
"
```

---

### 步骤 4：重启后端服务

**如果连接成功，重启服务：**

```bash
cd /root/apps/life-design-backend

# 完全重启
pm2 stop life-design-backend 2>/dev/null || true
pm2 delete life-design-backend 2>/dev/null || true
pm2 save --force
sleep 3

# 重新启动
pm2 start src/server.js --name life-design-backend --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 30 --nostream
```

---

## 🎯 一键修复命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 确认配置 ===" && \
echo "服务器私网IP: 172.30.67.7" && \
echo "服务器公网IP: 123.56.17.118" && \
echo "当前DB_HOST: $(grep DB_HOST .env | cut -d'=' -f2)" && \
echo "" && \
echo "=== 2. 确保使用内网地址 ===" && \
if grep -q "vo.mysql.rds" .env; then
  echo "⚠️  检测到外网地址，更新为内网地址..."
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  sed -i 's/rm-2ze0yppdih8t4t4e4vo\.mysql\.rds/rm-2ze0yppdih8t4t4e4.mysql.rds/g' .env
  echo "✅ 已更新为内网地址"
fi && \
echo "当前DB_HOST: $(grep DB_HOST .env | cut -d'=' -f2)" && \
echo "" && \
echo "=== 3. 测试数据库连接 ===" && \
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
      connectTimeout: 10000
    });
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功！');
    const [rows] = await connection.query('SELECT DATABASE() as db');
    console.log('✅ 当前数据库:', rows[0].db);
    connection.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ 连接失败:', error.code, error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('');
      console.error('💡 请在RDS白名单中添加:');
      console.error('   - 服务器私网IP: 172.30.67.7');
      console.error('   - 或整个VPC网段: 172.16.0.0/12');
    }
    process.exit(1);
  }
})();
" && \
if [ $? -eq 0 ]; then
  echo "" && \
  echo "=== 4. 重启后端服务 ===" && \
  pm2 stop life-design-backend 2>/dev/null || true && \
  pm2 delete life-design-backend 2>/dev/null || true && \
  pm2 save --force && \
  sleep 3 && \
  pm2 start src/server.js --name life-design-backend --update-env && \
  sleep 5 && \
  pm2 logs life-design-backend --lines 20 --nostream
fi
```

---

## 📋 操作清单

- [ ] **在RDS白名单中添加服务器私网IP：`172.30.67.7`**（最重要！）
- [ ] 或者添加整个VPC网段：`172.16.0.0/12`（推荐）
- [ ] 确认使用内网地址（不带 `vo`）
- [ ] 测试数据库连接
- [ ] 如果连接成功，重启后端服务
- [ ] 测试登录功能

---

## 💡 重要提示

**终端（SSH）连接的是ECS实例，数据库连接也是从这台ECS实例发起的。**

**因此：**
- ✅ RDS白名单需要添加**ECS实例的私网IP**（`172.30.67.7`）
- ✅ 使用**内网地址**连接（更快、更安全、免费）
- ❌ 不需要公网IP（如果使用内网地址）

---

**现在先去RDS控制台添加白名单，然后执行上面的测试命令！** 🚀

