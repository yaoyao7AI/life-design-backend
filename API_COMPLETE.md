# 🎉 后端 API 完整文档

## ✅ 所有 API 路由已完成

### 📋 API 概览

| 模块 | 路由前缀 | 状态 |
|------|---------|------|
| 认证 | `/api/auth` | ✅ 完成 |
| 肯定语 | `/api/affirmations` | ✅ 完成 |
| 收藏 | `/api/favorites` | ✅ 完成 |
| 愿景板 | `/api/vision` | ✅ 完成 |

---

## 🔐 认证 API (`/api/auth`)

### 1. 发送验证码
**POST** `/api/auth/send-code`

**请求体：**
```json
{
  "phone": "18210827464"
}
```

**响应：**
```json
{
  "success": true,
  "msg": "验证码发送成功"
}
```

---

### 2. 登录
**POST** `/api/auth/login`

**请求体：**
```json
{
  "phone": "18210827464",
  "code": "123456"
}
```

**响应：**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "phone": "18210827464"
  }
}
```

---

### 3. 获取当前用户信息
**GET** `/api/auth/me`

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "phone": "18210827464",
    "nickname": null,
    "avatar": null
  }
}
```

---

### 4. 更新用户资料
**PUT** `/api/auth/me`

**请求头：**
```
Authorization: Bearer <token>
```

**请求体：**
```json
{
  "nickname": "我的昵称",
  "avatar": "https://example.com/avatar.jpg"
}
```

**响应：**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "phone": "18210827464",
    "nickname": "我的昵称",
    "avatar": "https://example.com/avatar.jpg"
  }
}
```

---

## 📝 肯定语 API (`/api/affirmations`)

### 获取肯定语列表
**GET** `/api/affirmations`

**响应：**
```json
{
  "data": [
    {
      "id": 1,
      "code": "A001",
      "text": "我是最棒的",
      "category": "自信"
    }
  ]
}
```

---

## ⭐ 收藏 API (`/api/favorites`)

**所有接口都需要认证：`Authorization: Bearer <token>`**

### 1. 获取我的收藏列表
**GET** `/api/favorites`

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "affirmation_id": 1,
      "category": "自信",
      "created_at": "2025-12-17T02:00:00.000Z",
      "code": "A001",
      "text": "我是最棒的",
      "affirmation_category": "自信"
    }
  ]
}
```

---

### 2. 添加收藏
**POST** `/api/favorites`

**请求体：**
```json
{
  "affirmation_id": 1,
  "category": "自信"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "affirmation_id": 1,
    "category": "自信"
  }
}
```

---

### 3. 删除收藏
**DELETE** `/api/favorites/:id`

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

### 4. 检查是否已收藏
**GET** `/api/favorites/check/:affirmation_id`

**响应：**
```json
{
  "success": true,
  "isFavorite": true
}
```

---

## 🎨 愿景板 API (`/api/vision`)

**所有接口都需要认证：`Authorization: Bearer <token>`**

### 1. 获取我的愿景板列表
**GET** `/api/vision`

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "我的愿景板",
      "quadrant": "健康",
      "thumbnail": "https://example.com/thumb.jpg",
      "created_at": "2025-12-17T02:00:00.000Z"
    }
  ]
}
```

---

### 2. 获取单个愿景板详情（包含元素）
**GET** `/api/vision/:id`

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "name": "我的愿景板",
    "quadrant": "健康",
    "thumbnail": "https://example.com/thumb.jpg",
    "created_at": "2025-12-17T02:00:00.000Z",
    "elements": [
      {
        "id": 1,
        "type": "text",
        "content": "健康生活",
        "x": 100,
        "y": 200,
        "width": 200,
        "height": 50,
        "rotation": 0,
        "font_size": 24,
        "color": "#000000"
      },
      {
        "id": 2,
        "type": "image",
        "content": "https://example.com/image.jpg",
        "x": 300,
        "y": 400,
        "width": 200,
        "height": 200,
        "rotation": 0,
        "font_size": null,
        "color": null
      }
    ]
  }
}
```

---

### 3. 创建新愿景板
**POST** `/api/vision`

**请求体：**
```json
{
  "name": "我的愿景板",
  "quadrant": "健康",
  "thumbnail": "https://example.com/thumb.jpg"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "name": "我的愿景板",
    "quadrant": "健康",
    "thumbnail": "https://example.com/thumb.jpg"
  }
}
```

---

### 4. 更新愿景板
**PUT** `/api/vision/:id`

**请求体：**
```json
{
  "name": "更新后的名称",
  "quadrant": "工作",
  "thumbnail": "https://example.com/new-thumb.jpg"
}
```

**响应：**
```json
{
  "success": true,
  "message": "更新成功"
}
```

---

### 5. 删除愿景板
**DELETE** `/api/vision/:id`

**响应：**
```json
{
  "success": true,
  "message": "删除成功"
}
```

---

### 6. 保存愿景板元素
**POST** `/api/vision/:id/elements`

**请求体：**
```json
{
  "elements": [
    {
      "type": "text",
      "content": "健康生活",
      "x": 100,
      "y": 200,
      "width": 200,
      "height": 50,
      "rotation": 0,
      "font_size": 24,
      "color": "#000000"
    },
    {
      "type": "image",
      "content": "https://example.com/image.jpg",
      "x": 300,
      "y": 400,
      "width": 200,
      "height": 200,
      "rotation": 0
    }
  ]
}
```

**响应：**
```json
{
  "success": true,
  "message": "保存成功"
}
```

---

## 🔒 认证说明

大部分 API 需要 JWT Token 认证。在请求头中添加：

```
Authorization: Bearer <your_token>
```

Token 通过登录接口获取，有效期 30 天。

---

## 📊 数据库表结构

### users
- `id` (BIGINT, PRIMARY KEY)
- `phone` (VARCHAR(20), UNIQUE)
- `nickname` (VARCHAR(50))
- `avatar` (VARCHAR(255))
- `created_at` (TIMESTAMP)

### affirmations
- `id` (INT, PRIMARY KEY)
- `code` (VARCHAR(20), UNIQUE)
- `text` (TEXT)
- `category` (VARCHAR(20))
- `created_at` (TIMESTAMP)

### favorites
- `id` (BIGINT, PRIMARY KEY)
- `user_id` (BIGINT, FOREIGN KEY)
- `affirmation_id` (INT, FOREIGN KEY)
- `category` (VARCHAR(20))
- `created_at` (TIMESTAMP)

### vision_boards
- `id` (BIGINT, PRIMARY KEY)
- `user_id` (BIGINT, FOREIGN KEY)
- `name` (VARCHAR(100))
- `quadrant` (VARCHAR(20))
- `thumbnail` (VARCHAR(255))
- `created_at` (TIMESTAMP)

### vision_elements
- `id` (BIGINT, PRIMARY KEY)
- `board_id` (BIGINT, FOREIGN KEY)
- `type` (ENUM: 'text', 'image')
- `content` (TEXT)
- `x`, `y`, `width`, `height` (FLOAT)
- `rotation` (FLOAT)
- `font_size` (INT)
- `color` (VARCHAR(20))
- `created_at` (TIMESTAMP)

---

## ✅ 完成状态

- ✅ 所有数据库表已创建
- ✅ 认证 API 完整实现
- ✅ 收藏 API 完整实现（CRUD）
- ✅ 愿景板 API 完整实现（CRUD + 元素管理）
- ✅ 用户资料更新 API
- ✅ JWT 认证中间件
- ✅ 错误处理完善
- ✅ 数据验证完善

---

## 🚀 下一步

现在后端 API 已经完全就绪，可以：

1. **前端对接**：前端可以开始调用这些 API
2. **测试**：使用 Postman 或 curl 测试所有接口
3. **部署**：部署到生产环境

所有 API 都已准备好，可以开始前端迁移工作！



