# 📝 肯定语文字更新指南

## 🎯 如何更新肯定语文字（如 a002）

### 方法 1：通过 API 更新（推荐）

#### 更新单个肯定语文字

**接口：** `PUT /api/affirmations/:code`

**示例：更新 a002 的文字**

```bash
curl -X PUT http://123.56.17.118:3000/api/affirmations/a002 \
  -H "Content-Type: application/json" \
  -d '{
    "text": "新的肯定语文字内容",
    "category": "健康"
  }'
```

**请求体格式（JSON）：**
```json
{
  "text": "新的肯定语文字内容",
  "category": "健康"  // 可选，分类：健康/工作/爱/兴趣
}
```

**响应：**
```json
{
  "success": true,
  "message": "肯定语更新成功"
}
```

---

### 方法 2：直接更新数据库

#### 使用 SQL 更新

```sql
UPDATE affirmations 
SET text = '新的肯定语文字内容', 
    category = '健康' 
WHERE code = 'a002';
```

#### 使用 MySQL 命令行

```bash
mysql -h rm-2zec076upfs3zd44l1o.mysql.rds.aliyuncs.com \
  -u life_admin \
  -pYOUR_DB_PASSWORD \
  life_design \
  -e "UPDATE affirmations SET text = '新的肯定语文字内容' WHERE code = 'a002';"
```

---

## 📋 数据格式说明

### 需要提供的数据

**只需要提供纯文字即可！** 不需要文件。

**格式：**
- **code**: 肯定语代码（如 `a002`）- 唯一标识
- **text**: 肯定语文字内容（纯文本）
- **category**: 分类（可选）- `健康`、`工作`、`爱`、`兴趣`

### 示例数据

```json
{
  "code": "a002",
  "text": "我正在稳步构建自己的人生系统",
  "category": "健康"
}
```

---

## 🔧 API 接口说明

### 1. 获取所有肯定语
**GET** `/api/affirmations`

**响应：**
```json
{
  "data": [
    {
      "id": 1,
      "code": "a002",
      "text": "我正在稳步构建自己的人生系统",
      "category": "健康"
    }
  ]
}
```

---

### 2. 获取单个肯定语
**GET** `/api/affirmations/:code`

**示例：**
```bash
curl http://123.56.17.118:3000/api/affirmations/a002
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "code": "a002",
    "text": "我正在稳步构建自己的人生系统",
    "category": "健康"
  }
}
```

---

### 3. 更新肯定语文字
**PUT** `/api/affirmations/:code`

**请求体：**
```json
{
  "text": "新的文字内容",
  "category": "健康"  // 可选
}
```

**说明：**
- 如果 code 不存在，会自动创建
- 只需要提供 `text` 字段即可更新文字
- `category` 字段可选

---

### 4. 创建新肯定语
**POST** `/api/affirmations`

**请求体：**
```json
{
  "code": "a003",
  "text": "新的肯定语文字",
  "category": "工作"
}
```

---

## 📝 批量更新示例

### 使用 curl 批量更新

```bash
# 更新 a002
curl -X PUT http://123.56.17.118:3000/api/affirmations/a002 \
  -H "Content-Type: application/json" \
  -d '{"text": "新的文字1"}'

# 更新 a003
curl -X PUT http://123.56.17.118:3000/api/affirmations/a003 \
  -H "Content-Type: application/json" \
  -d '{"text": "新的文字2"}'
```

### 使用 JSON 文件批量更新

创建 `update-affirmations.json`：
```json
[
  {
    "code": "a002",
    "text": "新的文字1",
    "category": "健康"
  },
  {
    "code": "a003",
    "text": "新的文字2",
    "category": "工作"
  }
]
```

使用脚本批量更新：
```bash
#!/bin/bash
while IFS= read -r line; do
  code=$(echo $line | jq -r '.code')
  text=$(echo $line | jq -r '.text')
  category=$(echo $line | jq -r '.category')
  
  curl -X PUT http://123.56.17.118:3000/api/affirmations/$code \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"$text\", \"category\": \"$category\"}"
done < <(jq -c '.[]' update-affirmations.json)
```

---

## ✅ 更新步骤总结

### 最简单的方式（推荐）

1. **准备文字内容**（纯文本即可）
   ```
   我正在稳步构建自己的人生系统
   ```

2. **调用 API 更新**
   ```bash
   curl -X PUT http://123.56.17.118:3000/api/affirmations/a002 \
     -H "Content-Type: application/json" \
     -d '{"text": "我正在稳步构建自己的人生系统"}'
   ```

3. **验证更新**
   ```bash
   curl http://123.56.17.118:3000/api/affirmations/a002
   ```

---

## 🎯 常见问题

### Q: 需要提供什么格式的文件？
**A:** 不需要文件！只需要提供**纯文字**即可。

### Q: 可以批量更新吗？
**A:** 可以，使用循环调用 API 或直接更新数据库。

### Q: 如果 code 不存在会怎样？
**A:** API 会自动创建新的肯定语记录。

### Q: 音频文件在哪里？
**A:** 音频文件应该存储在前端或 CDN，后端只存储文字内容。音频文件名可以使用 code（如 `a002.mp3`）来关联。

---

## 📊 数据库表结构

```sql
CREATE TABLE affirmations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,  -- 唯一标识（如 a002）
    text TEXT NOT NULL,                -- 文字内容
    category VARCHAR(20),               -- 分类
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 快速开始

**更新 a002 的文字：**

```bash
curl -X PUT http://123.56.17.118:3000/api/affirmations/a002 \
  -H "Content-Type: application/json" \
  -d '{"text": "你的新文字内容"}'
```

**就这么简单！只需要提供纯文字即可！** ✨



