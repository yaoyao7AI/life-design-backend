# ⚠️ 紧急：数据库迁移需要执行

## 🚨 当前状态

**测试结果：** ❌ **数据库迁移未完成**

**证据：**
```json
{
  "error": "密码功能暂未启用",
  "message": "数据库表需要添加 password 字段"
}
```

---

## 📋 必须执行的步骤

### 步骤 1：登录阿里云 RDS 控制台

1. **访问：** https://ecs.console.aliyun.com
2. **登录** 你的阿里云账号
3. **进入：** 左侧菜单 → **云数据库 RDS**
4. **选择：** 你的数据库实例（life_design）

---

### 步骤 2：打开数据管理（DMS）

**方法 A：通过 RDS 控制台**
1. 点击数据库实例
2. 点击 **数据管理（DMS）** 或 **登录数据库**

**方法 B：直接访问 DMS**
1. 访问：https://dms.console.aliyun.com
2. 选择你的数据库实例

---

### 步骤 3：执行 SQL 脚本

1. **打开 SQL 窗口**
   - 点击 **SQL 窗口** 或 **SQL 控制台**
   - 或点击顶部菜单的 **SQL 操作**

2. **选择数据库**
   - 在左侧数据库列表中选择：`life_design`
   - 或在下拉菜单中选择：`life_design`

3. **执行 SQL**
   ```sql
   USE life_design;
   
   ALTER TABLE users 
   ADD COLUMN password VARCHAR(255) NULL AFTER phone;
   ```

4. **点击执行**
   - 点击 **执行** 或按 `F8`
   - 等待执行完成

---

### 步骤 4：验证字段已添加

**执行验证 SQL：**
```sql
DESCRIBE users;
```

**预期结果：**
应该能看到 `password` 字段，类似这样：

```
+------------+--------------+------+-----+---------+----------------+
| Field      | Type         | Null | Key | Default | Extra          |
+------------+--------------+------+-----+---------+----------------+
| id         | bigint       | NO   | PRI | NULL    | auto_increment |
| phone      | varchar(20)  | NO   | UNI | NULL    |                |
| password   | varchar(255) | YES  |     | NULL    |                | ← 新字段
| nickname   | varchar(50)  | YES  |     | NULL    |                |
| avatar     | varchar(255) | YES  |     | NULL    |                |
| created_at | timestamp   | YES  |     | CURRENT_TIMESTAMP |      |
+------------+--------------+------+-----+---------+----------------+
```

---

## 🔍 验证迁移是否成功

### 方法 1：使用检查脚本

```bash
cd /Users/mac/Desktop/life-design-backend
./check_database_migration.sh
```

**成功标志：**
- 返回 `"token 无效或已过期"` → ✅ 迁移完成
- 返回 `"密码功能暂未启用"` → ❌ 迁移未完成

---

### 方法 2：使用完整测试脚本

```bash
cd /Users/mac/Desktop/life-design-backend
./complete_function_test.sh
```

**成功标志：**
- 最后一步显示 `✅ 修改密码成功！` → ✅ 迁移完成
- 最后一步显示 `❌ 数据库迁移未完成` → ❌ 迁移未完成

---

## ⚠️ 常见问题

### 问题 1：找不到数据库

**检查：**
- 确认数据库名称是 `life_design`（不是 `life-design`）
- 确认已选择正确的数据库实例

---

### 问题 2：权限不足

**错误信息：**
```
ERROR 1142 (42000): ALTER command denied to user 'xxx'@'xxx'
```

**解决：**
- 确认使用的是有 ALTER TABLE 权限的用户
- 联系数据库管理员授权

---

### 问题 3：字段已存在

**错误信息：**
```
ERROR 1060 (42S21): Duplicate column name 'password'
```

**解决：**
- 字段已存在，可以忽略
- 执行验证 SQL 确认字段存在

---

### 问题 4：表不存在

**错误信息：**
```
ERROR 1146 (42S02): Table 'life_design.users' doesn't exist
```

**解决：**
- 确认数据库名称正确
- 确认表名正确：`users`
- 检查表是否已创建

---

## 📋 快速执行 SQL

### 一键执行（复制粘贴）

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
DESCRIBE users;
```

---

## ✅ 迁移完成后的验证

### 1. 检查数据库字段

```sql
DESCRIBE users;
-- 应该能看到 password 字段
```

### 2. 测试接口

```bash
cd /Users/mac/Desktop/life-design-backend
./complete_function_test.sh
```

**预期结果：**
```
✅ 修改密码成功！
🎉 功能测试通过！
```

---

## 🎯 执行时间

**预计时间：** 5-10 分钟

**步骤：**
1. 登录控制台：1 分钟
2. 打开 DMS：1 分钟
3. 执行 SQL：1 分钟
4. 验证结果：2 分钟

---

## 📞 如果遇到问题

### 无法访问 RDS 控制台

**检查：**
- 网络连接是否正常
- 账号是否有权限
- 浏览器是否支持

---

### SQL 执行失败

**检查：**
- SQL 语法是否正确
- 数据库连接是否正常
- 用户权限是否足够

---

### 字段添加后仍报错

**检查：**
- 确认字段名称正确：`password`
- 确认字段类型正确：`VARCHAR(255)`
- 重启后端服务：
  ```bash
  ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118
  pm2 restart life-design-backend
  ```

---

## 🚀 执行完成后

### 立即验证

```bash
cd /Users/mac/Desktop/life-design-backend
./complete_function_test.sh
```

**应该看到：**
```
✅ 修改密码成功！
🎉 功能测试通过！
```

---

## 📝 重要提醒

### ⚠️ 这是必须的步骤

**如果不执行数据库迁移：**
- ❌ 修改密码接口会返回 501 错误
- ❌ 功能无法正常使用
- ❌ 前端会显示错误

**执行数据库迁移后：**
- ✅ 修改密码接口正常工作
- ✅ 功能完全可用
- ✅ 所有测试通过

---

**请立即执行数据库迁移！** 🚀



