# 🗑️ 清空数据 SQL（快速版）

## ⚠️ 警告
**这会删除 `users` 表中的所有数据，无法恢复！**

---

## 🚀 快速执行（3步）

### 步骤 1：切换到数据库

```sql
USE life_design;
```

---

### 步骤 2：添加 password 字段（如果不存在）

```sql
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
```

**如果字段已存在，会报错，可以忽略。**

---

### 步骤 3：清空所有数据

```sql
TRUNCATE TABLE users;
```

---

## 📋 完整 SQL（一键复制）

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
TRUNCATE TABLE users;
DESCRIBE users;
SELECT COUNT(*) FROM users;
```

**点击"执行(F8)"**

---

## ✅ 验证结果

**执行后应该看到：**
- ✅ `DESCRIBE users;` 显示 `password` 字段
- ✅ `SELECT COUNT(*) FROM users;` 返回 0

---

**确认要清空数据吗？** 🚀

