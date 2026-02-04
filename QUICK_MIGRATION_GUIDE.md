# ⚡ 快速数据库迁移指南（5分钟完成）

## 🎯 目标

在 `users` 表中添加 `password` 字段，使修改密码功能正常工作。

---

## 📋 快速步骤（3步完成）

### 步骤 1：登录阿里云 RDS（1分钟）

1. **访问：** https://ecs.console.aliyun.com
2. **登录** 你的账号
3. **点击：** 左侧菜单 → **云数据库 RDS**
4. **选择：** 你的数据库实例

---

### 步骤 2：执行 SQL（1分钟）

1. **点击：** **数据管理（DMS）** 或 **登录数据库**
2. **打开：** **SQL 窗口**
3. **选择数据库：** `life_design`
4. **复制粘贴以下 SQL：**

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
```

5. **点击：** **执行** 按钮（或按 `F8`）

---

### 步骤 3：验证（1分钟）

**执行验证 SQL：**
```sql
DESCRIBE users;
```

**应该能看到：**
```
| password   | varchar(255) | YES  |     | NULL    |                |
```

---

## ✅ 验证迁移成功

### 方法 1：使用检查脚本（推荐）

```bash
cd /Users/mac/Desktop/life-design-backend
./check_database_migration.sh
```

**成功标志：**
```
✅ 数据库迁移已完成！
```

---

### 方法 2：使用完整测试脚本

```bash
cd /Users/mac/Desktop/life-design-backend
./complete_function_test.sh
```

**成功标志：**
```
✅ 修改密码成功！
🎉 功能测试通过！
```

---

## 🚨 如果遇到问题

### 问题 1：找不到数据库

**检查：**
- 数据库名称是 `life_design`（不是 `life-design`）
- 确认已选择正确的数据库实例

---

### 问题 2：权限不足

**错误：** `ERROR 1142: ALTER command denied`

**解决：**
- 确认使用的是有权限的用户
- 联系数据库管理员

---

### 问题 3：字段已存在

**错误：** `ERROR 1060: Duplicate column name 'password'`

**解决：**
- 字段已存在，迁移已完成
- 可以忽略此错误

---

## 📝 SQL 脚本（一键复制）

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
DESCRIBE users;
```

---

## 🎯 完成标志

迁移完成后，运行测试：

```bash
./complete_function_test.sh
```

**应该看到：**
```
✅ 修改密码成功！
🎉 功能测试通过！
```

---

**预计时间：5分钟** ⏱️



