# 🔗 短链接功能后端实现

## ✅ 已实现功能

### 1. **自动生成 Code**
- 格式：`001`, `002`, `003`（3位数字，自动递增）
- 如果没有提供 code，自动生成下一个可用的数字 code
- 查询当前最大数字 code，然后 +1

### 2. **自动生成 Short URL**
- 格式：`http://localhost:5174/play?a=001`
- 基于前端基础 URL + `/play?a=` + code
- 前端基础 URL 从环境变量 `FRONTEND_BASE_URL` 读取

### 3. **数据库字段支持**
- 自动检测表是否有 `short_url` 字段
- 如果有字段，存储到数据库
- 如果没有字段，在返回时动态生成

### 4. **API 响应更新**
所有 API 接口现在都返回 `code` 和 `short_url` 字段：

**GET /api/affirmations**
```json
[
  {
    "id": 1,
    "title": "标题",
    "text": "文本内容",
    "audio_url": "",
    "code": "001",
    "short_url": "http://localhost:5174/play?a=001"
  }
]
```

**GET /api/affirmations/:id**
```json
{
  "id": 1,
  "title": "标题",
  "text": "文本内容",
  "audio_url": "",
  "code": "001",
  "short_url": "http://localhost:5174/play?a=001"
}
```

**POST /api/affirmations**
- 创建时自动生成 code 和 short_url
- 返回包含这两个字段

**PUT /api/affirmations/:id**
- 如果更新 code，自动重新生成 short_url
- 返回包含更新后的 code 和 short_url

---

## 🔧 配置说明

### 环境变量

在 `.env` 文件中添加：

```env
# 前端基础 URL（用于生成短链接）
FRONTEND_BASE_URL=http://localhost:5174

# 生产环境
# FRONTEND_BASE_URL=https://yourdomain.com
```

**默认值：** 如果未设置，默认使用 `http://localhost:5174`

---

## 📊 数据库更新

### 添加 short_url 字段（可选）

如果需要将 short_url 存储到数据库，执行：

```sql
USE life_design;

ALTER TABLE affirmations 
ADD COLUMN short_url VARCHAR(500) AFTER audio_url;
```

**说明：**
- 如果不添加字段，代码会自动在返回时生成 short_url
- 添加字段后，short_url 会存储到数据库，提高查询效率

---

## 🎯 Code 生成逻辑

### 自动生成规则

1. **查询现有数字 code**
   ```sql
   SELECT code FROM affirmations 
   WHERE code REGEXP '^[0-9]+$' 
   ORDER BY CAST(code AS UNSIGNED) DESC 
   LIMIT 1
   ```

2. **生成下一个 code**
   - 如果找到最大 code：`最大code + 1`
   - 如果没找到：从 `001` 开始
   - 格式化为3位数字：`001`, `002`, `003`...

3. **示例**
   - 第一条：`001`
   - 第二条：`002`
   - 第三条：`003`
   - ...

---

## 🧪 测试

### 1. 创建肯定语（自动生成 code 和 short_url）

```bash
curl -X POST http://123.56.17.118:3000/api/affirmations \
  -H "Content-Type: application/json" \
  -d '{
    "title": "测试标题",
    "text": "测试文本内容"
  }'
```

**响应：**
```json
{
  "id": 5,
  "title": "测试标题",
  "text": "测试文本内容",
  "audio_url": "",
  "code": "005",
  "short_url": "http://localhost:5174/play?a=005"
}
```

### 2. 获取列表（包含 short_url）

```bash
curl http://123.56.17.118:3000/api/affirmations
```

### 3. 根据 code 获取（用于播放页面）

```bash
curl http://123.56.17.118:3000/api/affirmations/001
```

---

## ✅ 功能检查清单

- [x] 自动生成格式化的 code（001, 002, 003）
- [x] 自动生成 short_url
- [x] GET /api/affirmations 返回 code 和 short_url
- [x] GET /api/affirmations/:id 返回 code 和 short_url
- [x] GET /api/affirmations/:code 支持通过 code 查询
- [x] POST /api/affirmations 自动生成 code 和 short_url
- [x] PUT /api/affirmations/:id 更新时重新生成 short_url（如果 code 改变）
- [x] 兼容数据库有无 short_url 字段的情况
- [x] 环境变量配置支持

---

## 🚀 部署步骤

### 1. 更新代码

```bash
# 上传更新后的 affirmations.js
scp src/routes/affirmations.js root@123.56.17.118:/root/apps/life-design-backend/src/routes/
```

### 2. 更新环境变量（可选）

```bash
# SSH 到服务器
ssh root@123.56.17.118

# 编辑 .env
cd /root/apps/life-design-backend
nano .env

# 添加：
FRONTEND_BASE_URL=http://localhost:5174
# 或生产环境：
# FRONTEND_BASE_URL=https://yourdomain.com
```

### 3. 更新数据库（可选）

如果需要存储 short_url 到数据库：

```bash
# 在阿里云 RDS 执行
mysql -h rm-2zec076upfs3zd44l1o.mysql.rds.aliyuncs.com \
  -u life_admin \
  -pYOUR_DB_PASSWORD \
  life_design \
  -e "ALTER TABLE affirmations ADD COLUMN short_url VARCHAR(500) AFTER audio_url;"
```

### 4. 重启服务

```bash
pm2 restart life-design-backend
```

---

## 🎉 完成状态

**短链接功能后端实现完成！**

**特性：**
- ✅ 自动生成格式化的 code
- ✅ 自动生成 short_url
- ✅ 所有 API 返回 code 和 short_url
- ✅ 支持通过 code 查询
- ✅ 兼容数据库结构

**前端现在可以：**
- ✅ 显示短链接
- ✅ 复制短链接
- ✅ 通过短链接播放肯定语

**后端短链接功能已就绪！** 🚀



