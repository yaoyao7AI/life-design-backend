# 🚀 创建数据库和表 SQL（完整版）

## 🎯 目标
创建 `life_design` 数据库和 `users` 表（包含 `password` 字段）

---

## 📋 完整 SQL（一键复制执行）

```sql
-- 1. 创建数据库
CREATE DATABASE IF NOT EXISTS life_design CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. 切换到新创建的数据库
USE life_design;

-- 3. 创建 users 表（包含 password 字段）
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
  phone VARCHAR(20) NOT NULL UNIQUE COMMENT '手机号',
  password VARCHAR(255) NULL COMMENT '密码',
  nickname VARCHAR(50) COMMENT '昵称',
  avatar VARCHAR(255) COMMENT '头像URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 4. 验证数据库创建成功
SHOW DATABASES LIKE 'life_design';

-- 5. 验证表创建成功
SHOW TABLES;

-- 6. 查看表结构（确认 password 字段存在）
DESCRIBE users;
```

---

## 🚀 快速执行步骤

### 步骤 1：复制 SQL

**复制上面的完整 SQL**

---

### 步骤 2：粘贴到 DMS SQL 控制台

1. **在 SQL 输入框（中间大文本框）中**
2. **删除所有现有内容**
3. **粘贴 SQL**（Ctrl+V 或 Cmd+V）

---

### 步骤 3：执行 SQL

**点击"执行(F8)"按钮**（蓝色，带播放图标）

---

## ✅ 执行后的结果

**应该看到：**

1. **数据库创建成功**
   - `SHOW DATABASES LIKE 'life_design';` 显示 `life_design`

2. **表创建成功**
   - `SHOW TABLES;` 显示 `users`

3. **表结构正确**
   - `DESCRIBE users;` 显示所有字段，包括：
     - `id`（主键）
     - `phone`（手机号，唯一）
     - `password`（密码，可为空）✅
     - `nickname`（昵称）
     - `avatar`（头像）
     - `created_at`（创建时间）

---

## 📋 表结构说明

### users 表字段：

| 字段名 | 类型 | 说明 | 约束 |
|--------|------|------|------|
| id | BIGINT | 用户ID | 主键，自增 |
| phone | VARCHAR(20) | 手机号 | 非空，唯一 |
| password | VARCHAR(255) | 密码 | 可为空 ✅ |
| nickname | VARCHAR(50) | 昵称 | 可为空 |
| avatar | VARCHAR(255) | 头像URL | 可为空 |
| created_at | TIMESTAMP | 创建时间 | 默认当前时间 |

---

## 🔍 验证清单

执行后检查：

- [ ] `SHOW DATABASES;` 能看到 `life_design`
- [ ] `SHOW TABLES;` 能看到 `users`
- [ ] `DESCRIBE users;` 能看到 `password` 字段
- [ ] `password` 字段类型是 `varchar(255)`
- [ ] `password` 字段允许 NULL

---

## 🎯 如果执行出错

### 错误 1：数据库已存在

**错误信息：** `ERROR 1007: Can't create database 'life_design'; database exists`

**解决：**
- 使用 `USE life_design;` 切换到数据库
- 然后执行创建表的 SQL

---

### 错误 2：表已存在

**错误信息：** `ERROR 1050: Table 'users' already exists`

**解决：**
- 如果表已存在，直接执行：
  ```sql
  USE life_design;
  ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
  DESCRIBE users;
  ```

---

### 错误 3：权限不足

**错误信息：** `ERROR 1044: Access denied`

**解决：**
- 确认使用的是高权限账号
- 联系数据库管理员授权

---

## 📝 简化版 SQL（如果完整版出错）

**如果上面的 SQL 执行出错，尝试这个简化版：**

```sql
CREATE DATABASE life_design;
USE life_design;
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NULL,
  nickname VARCHAR(50),
  avatar VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
DESCRIBE users;
```

---

## ✅ 完成标志

**执行成功后：**

1. ✅ 数据库 `life_design` 已创建
2. ✅ 表 `users` 已创建
3. ✅ `password` 字段已存在
4. ✅ 表结构完整，可以正常使用

---

**现在就可以执行了！复制上面的 SQL，粘贴到 DMS，点击执行！** 🚀

