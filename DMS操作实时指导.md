# 🎯 DMS 操作实时指导（基于当前界面）

## 📍 当前状态

根据您的截图：
- ✅ **DMS 已打开**
- ✅ **SQL 控制台已打开**
- ⚠️ **当前数据库：`information_schema`**（需要切换）
- ⚠️ **实例ID：`rm-2zec076upfs3zd441`**（请确认是否正确）

---

## 🚀 立即操作步骤（3步完成）

### 步骤 1：切换到正确的数据库（30秒）

**在左侧数据库实例树中：**

1. **找到实例：** `rm-2zec076upfs3zd441`
   - 在左侧"数据库实例"区域
   - 点击实例名称展开

2. **找到数据库：** `life_design`
   - 在实例下方展开的列表中
   - 如果看不到，在搜索框输入 `life_design` 搜索
   - **点击 `life_design` 数据库**

3. **确认已选中**
   - `life_design` 应该高亮显示
   - 或者顶部标签页显示 `life_design@rm-2zec076upfs3zd441`

---

### 步骤 2：执行迁移 SQL（1分钟）

**在 SQL 控制台（中间的大文本框）：**

1. **清空当前内容**
   - 选中 `SELECT * FROM`
   - 按 `Delete` 或 `Backspace` 删除

2. **复制以下 SQL：**
   ```sql
   USE life_design;
   ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
   DESCRIBE users;
   ```

3. **粘贴到 SQL 输入框**
   - 点击文本框
   - 按 `Ctrl + V`（Windows）或 `Cmd + V`（Mac）

4. **点击执行按钮**
   - 找到工具栏中的 **"执行(F8)"** 按钮（蓝色，带播放图标）
   - 或直接按键盘 `F8`

---

### 步骤 3：查看结果（30秒）

**执行后，下方会显示结果：**

**✅ 成功标志：**
- 显示 `users` 表的结构表格
- 在表格中找到 `password` 字段行
- 应该显示：
  ```
  Field: password
  Type: varchar(255)
  Null: YES
  ```

**❌ 如果报错：**
- 查看错误信息
- 参考下方"常见错误"部分

---

## 🔍 如果找不到 `life_design` 数据库

### 方法 1：搜索数据库

1. **在左侧搜索框输入：** `life_design`
2. **点击搜索结果**

### 方法 2：查看所有数据库

1. **在 SQL 控制台输入：**
   ```sql
   SHOW DATABASES;
   ```
2. **点击执行**
3. **查看结果列表**，找到 `life_design`
4. **双击 `life_design`** 切换到该数据库

### 方法 3：直接使用 SQL 切换

1. **在 SQL 控制台输入：**
   ```sql
   USE life_design;
   ```
2. **点击执行**
3. **确认顶部显示已切换到 `life_design`**

---

## ⚠️ 实例ID确认

**当前显示的实例ID：** `rm-2zec076upfs3zd441`

**之前提供的实例ID：** `rm-2ze0yppdih8t4t4e4`

**请确认：**
- 这两个实例ID是否指向同一个数据库？
- 还是您有多个数据库实例？
- `life_design` 数据库在哪个实例中？

---

## 📋 完整 SQL（一键复制）

**复制以下全部内容，一次性执行：**

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
DESCRIBE users;
```

**这个 SQL 会：**
1. 切换到 `life_design` 数据库
2. 添加 `password` 字段
3. 显示表结构（验证字段已添加）

---

## 🎯 界面元素说明

根据您的截图：

**顶部标签页：**
- 显示当前连接的数据库和实例
- 当前显示：`information_schema@rm-2zec076upfs3zd441`
- 需要切换到：`life_design@rm-2zec076upfs3zd441`

**左侧数据库树：**
- 展开实例 `rm-2zec076upfs3zd441`
- 找到并点击 `life_design`

**SQL 控制台工具栏：**
- **"执行(F8)"** 按钮：蓝色，带播放图标
- 点击这个按钮执行 SQL

**SQL 输入框：**
- 中间的大白色文本框
- 当前显示：`SELECT * FROM`
- 需要替换为迁移 SQL

---

## ✅ 执行完成后的验证

**执行成功后，运行验证脚本：**

```bash
cd /Users/mac/Desktop/life-design-backend
./verify_migration.sh
```

**应该看到：**
```
✅ 数据库迁移已完成！
```

---

## 🚨 如果遇到问题

### 问题 1：找不到 `life_design` 数据库

**解决：**
- 执行 `SHOW DATABASES;` 查看所有数据库
- 确认数据库名称是否正确（可能是 `life-design` 或其他）

### 问题 2：权限不足

**错误：** `ERROR 1142: ALTER command denied`

**解决：**
- 确认当前账号有 ALTER TABLE 权限
- 联系数据库管理员授权

### 问题 3：表不存在

**错误：** `Table 'life_design.users' doesn't exist`

**解决：**
- 确认数据库名称正确
- 执行 `SHOW TABLES;` 查看所有表
- 确认表名是 `users`（不是 `user`）

---

**现在就可以开始操作了！** 🚀

**按照步骤 1-3 执行，有任何问题随时告诉我！**

