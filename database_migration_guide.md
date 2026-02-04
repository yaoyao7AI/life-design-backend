# 📋 数据库迁移指南 - 添加 password 字段

## 🎯 迁移目标

在 `users` 表中添加 `password` 字段，支持修改密码功能。

---

## 📝 SQL 脚本

### 完整 SQL 脚本

```sql
-- ============================================
-- 添加 password 字段到 users 表
-- 执行时间：2025-01-XX
-- ============================================

USE life_design;

-- 检查字段是否已存在
SELECT COLUMN_NAME 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'life_design' 
  AND TABLE_NAME = 'users' 
  AND COLUMN_NAME = 'password';

-- 如果字段不存在，执行以下语句
ALTER TABLE users 
ADD COLUMN password VARCHAR(255) NULL AFTER phone;

-- 验证字段是否添加成功
DESCRIBE users;
```

---

## 🔧 执行步骤

### 方法 1：使用阿里云 RDS 控制台（推荐）

1. **登录阿里云控制台**
   - 访问：https://ecs.console.aliyun.com
   - 登录你的账号

2. **进入 RDS 管理**
   - 左侧菜单 → **云数据库 RDS**
   - 选择你的数据库实例

3. **打开数据管理（DMS）**
   - 点击 **数据管理（DMS）**
   - 或点击 **登录数据库**

4. **执行 SQL**
   - 点击 **SQL 窗口** 或 **SQL 控制台**
   - 选择数据库：`life_design`
   - 粘贴上面的 SQL 脚本
   - 点击 **执行**

5. **验证结果**
   ```sql
   DESCRIBE users;
   ```
   - 应该能看到 `password` 字段
   - 字段类型：`varchar(255)`
   - 允许 NULL：`YES`

---

### 方法 2：使用 MySQL 客户端

```bash
# 1. 连接到数据库
mysql -h rm-2zec076upfs3zd44l1o.mysql.rds.aliyuncs.com \
      -u life_admin \
      -p \
      life_design

# 2. 执行 SQL
USE life_design;

ALTER TABLE users 
ADD COLUMN password VARCHAR(255) NULL AFTER phone;

# 3. 验证
DESCRIBE users;

# 4. 退出
EXIT;
```

---

## ✅ 验证步骤

### 1. 检查字段是否存在

```sql
-- 方法 A：使用 DESCRIBE
DESCRIBE users;

-- 方法 B：查询 INFORMATION_SCHEMA
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'life_design'
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'password';
```

**预期结果：**
```
+----------+--------------+------+-----+---------+-------+
| Field    | Type         | Null | Key | Default | Extra |
+----------+--------------+------+-----+---------+-------+
| id       | bigint       | NO   | PRI | NULL    | auto_increment |
| phone    | varchar(20)  | NO   | UNI | NULL    |                |
| password | varchar(255) | YES  |     | NULL    |                |  ← 新字段
| nickname | varchar(50)  | YES  |     | NULL    |                |
| avatar   | varchar(255) | YES  |     | NULL    |                |
| created_at | timestamp | YES  |     | CURRENT_TIMESTAMP |      |
+----------+--------------+------+-----+---------+-------+
```

---

### 2. 测试修改密码接口

```bash
# 1. 先登录获取 token
TOKEN=$(curl -X POST http://123.56.17.118:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"18210827464","code":"123456"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. 测试修改密码接口
curl -X POST http://123.56.17.118:3000/api/auth/update-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"newpass123"}'
```

**预期响应：**
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

---

## ⚠️ 常见问题

### 问题 1：字段已存在

**错误信息：**
```
ERROR 1060 (42S21): Duplicate column name 'password'
```

**解决方法：**
- 字段已存在，无需重复添加
- 可以跳过此步骤

---

### 问题 2：权限不足

**错误信息：**
```
ERROR 1142 (42000): ALTER command denied to user 'xxx'@'xxx'
```

**解决方法：**
- 确认数据库用户有 ALTER TABLE 权限
- 联系数据库管理员授权

---

### 问题 3：表不存在

**错误信息：**
```
ERROR 1146 (42S02): Table 'life_design.users' doesn't exist
```

**解决方法：**
- 确认数据库名称正确：`life_design`
- 确认表名正确：`users`
- 检查表是否已创建

---

## 📋 迁移检查清单

- [ ] 已登录阿里云 RDS 控制台
- [ ] 已打开数据管理（DMS）
- [ ] 已选择正确的数据库：`life_design`
- [ ] 已执行 SQL 脚本
- [ ] 已验证字段已添加（DESCRIBE users）
- [ ] 已测试修改密码接口
- [ ] 接口返回成功响应

---

## 🎯 迁移完成后的操作

1. **部署后端代码**
   ```bash
   # 执行部署脚本
   chmod +x deploy_backend_fix.sh
   ./deploy_backend_fix.sh
   ```

2. **验证功能**
   - 测试修改密码接口
   - 检查前端个人资料页面

3. **监控日志**
   ```bash
   # 查看后端日志
   ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118
   pm2 logs life-design-backend
   ```

---

## 📝 注意事项

### ⚠️ 密码安全

**当前实现：**
- ⚠️ 密码以明文存储（仅用于开发测试）
- ⚠️ 生产环境需要加密

**生产环境建议：**
- ✅ 使用 bcrypt 加密密码
- ✅ 添加密码强度验证
- ✅ 添加密码历史记录

---

## 🚀 快速执行

### 一键执行 SQL

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
DESCRIBE users;
```

---

**迁移完成后，记得执行后端部署！** 🎯



