# 🔄 切换到 life_design 数据库

## ✅ 当前状态
- ✅ `life_design` 数据库已存在（在实例 `rm-2zec076upfs3zd441` 下）
- ⚠️ 当前打开了"创建数据库"对话框（需要关闭）

---

## 📋 切换步骤（2种方法）

### 方法 1：通过左侧数据库树（推荐）

#### 步骤 1：关闭"创建数据库"对话框

**点击对话框右上角的 "X" 按钮**，或点击底部的"取消"按钮

---

#### 步骤 2：在左侧数据库树中点击

1. **在左侧"数据库实例"区域**
   - 找到实例：`rm-2zec076upfs3zd441`
   - 找到数据库：`life_design`（已经在列表中）
   - **点击 `life_design` 数据库**

2. **确认已切换**
   - 顶部标签页应该显示：`life_design@rm-2zec076upfs3zd441`
   - 或连接字符串显示：`life_design@rm-2zec076upfs3zd441.mysql.rds.aliyuncs.com:3306`
   - 左侧数据库树中，`life_design` 应该高亮显示

---

### 方法 2：通过 SQL 切换

#### 步骤 1：关闭"创建数据库"对话框

**点击对话框右上角的 "X" 按钮**，或点击底部的"取消"按钮

---

#### 步骤 2：在 SQL 控制台执行

**在 SQL 输入框（中间大文本框）中：**

1. **删除现有内容**（`SELECT * FROM`）
2. **输入：**
   ```sql
   USE life_design;
   ```
3. **点击"执行(F8)"按钮**

---

## ✅ 切换成功的标志

**切换成功后，应该看到：**

1. **顶部标签页显示：**
   - `life_design@rm-2zec076upfs3zd441`
   - 或 `生产 life_design rm-2zec076upfs3zd441`

2. **左侧数据库树中：**
   - `life_design` 数据库高亮显示
   - 可以看到 `life_design` 下的表：
     - `users`
     - `affirmations`
     - `favorites`
     - `practice_logs`
     - `sms_codes`
     - `vision_boards`
     - `vision_elements`

3. **SQL 控制台：**
   - 可以执行针对 `life_design` 数据库的 SQL

---

## 🎯 切换后的下一步

**切换到 `life_design` 数据库后，需要：**

### 检查 users 表是否有 password 字段

**执行以下 SQL：**
```sql
DESCRIBE users;
```

**查看结果：**
- ✅ 如果看到 `password` 字段 → 迁移已完成
- ❌ 如果没有 `password` 字段 → 需要添加字段

---

### 如果没有 password 字段，执行迁移 SQL

```sql
USE life_design;
ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
DESCRIBE users;
```

**点击"执行(F8)"**

---

## 📋 快速操作

### 1. 关闭对话框
- 点击"创建数据库"对话框右上角的 "X"
- 或点击"取消"按钮

### 2. 切换到数据库
- **方法 A：** 在左侧点击 `life_design`
- **方法 B：** 在 SQL 控制台执行 `USE life_design;`

### 3. 验证切换成功
- 查看顶部标签页是否显示 `life_design`
- 查看左侧 `life_design` 是否高亮

---

## 🚀 立即操作

**现在就可以操作：**

1. **关闭"创建数据库"对话框**（点击 X 或取消）
2. **在左侧点击 `life_design` 数据库**
3. **确认顶部显示已切换到 `life_design`**

**切换成功后，告诉我，我会指导下一步！** 🎯

