# ✅ 添加 password 字段执行步骤

## 📍 当前状态
- ✅ 已成功切换到 `life_design` 数据库
- ✅ `users` 表已存在
- ❌ **`password` 字段不存在**（需要添加）

**当前 `users` 表字段：**
- `id` (BIGINT)
- `phone` (VARCHAR(20))
- `nickname` (VARCHAR(50))
- `avatar` (VARCHAR(255))
- `created_at` (TIMESTAMP)

**缺少：** `password` 字段

---

## 🚀 执行步骤（2步完成）

### 步骤 1：打开 SQL 控制台

**在右侧找到 "SQL" 标签页，点击打开**

---

### 步骤 2：执行添加字段 SQL

**在 SQL 输入框中：**

1. **清空现有内容**（如果有 `users` 或其他内容）
2. **复制粘贴以下 SQL：**
   ```sql
   USE life_design;
   ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
   DESCRIBE users;
   ```

3. **点击"执行(F8)"按钮**（蓝色，带播放图标）

---

## ✅ 执行后的结果

**执行成功后，应该看到：**

1. **执行成功的提示**
   - 显示"执行成功"或"Affected rows: 1"

2. **表结构结果**
   - `DESCRIBE users;` 会显示更新后的表结构
   - 应该能看到 `password` 字段，位置在 `phone` 字段之后：
     ```
     Field: password
     Type: varchar(255)
     Null: YES
     Key: (空)
     Default: NULL
     Extra: (空)
     ```

---

## 📋 完整 SQL（一键复制）

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
DESCRIBE users;
```

**点击"执行(F8)"**

---

## 🔍 验证字段已添加

**执行后，检查结果：**

- ✅ `DESCRIBE users;` 结果中应该能看到 `password` 字段
- ✅ `password` 字段类型是 `varchar(255)`
- ✅ `password` 字段允许 NULL
- ✅ `password` 字段位置在 `phone` 之后

---

## 🚨 如果执行出错

### 错误 1：字段已存在

**错误信息：**
```
ERROR 1060: Duplicate column name 'password'
```

**解决：**
- ✅ **这是好消息！** 说明字段已经存在
- 执行 `DESCRIBE users;` 验证字段存在即可

---

### 错误 2：权限不足

**错误信息：**
```
ERROR 1142: ALTER command denied
```

**解决：**
- 确认使用的是高权限账号
- 联系数据库管理员授权

---

### 错误 3：表不存在

**错误信息：**
```
ERROR 1146: Table 'life_design.users' doesn't exist
```

**解决：**
- 确认已切换到 `life_design` 数据库
- 执行 `SHOW TABLES;` 查看所有表

---

## 🎯 操作要点

**当前界面：**
- ✅ 左侧：`life_design` 数据库已选中（高亮显示）
- ✅ 顶部：显示 `life_design@rm-2zec076upfs3zd441`
- ✅ 右侧：可以看到 `users` 表的字段列表

**需要操作：**
1. 点击右侧的 "SQL" 标签页
2. 在 SQL 输入框粘贴 SQL
3. 点击"执行(F8)"

---

## ✅ 完成标志

**执行成功后：**
- ✅ `DESCRIBE users;` 显示 `password` 字段
- ✅ 字段位置在 `phone` 之后
- ✅ 字段类型是 `varchar(255)`
- ✅ 字段允许 NULL

**然后可以运行验证脚本确认！**

---

**现在就可以执行了！复制上面的 SQL，粘贴到 SQL 控制台，点击执行！** 🚀

