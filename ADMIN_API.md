# 🔧 管理后台 API 文档

## ✅ 已创建的管理后台路由

### 基础信息

**基础路径：** `/admin`

**认证要求：** 除首页外，其他接口需要 JWT 认证

---

## 📋 API 端点

### 1. **管理后台首页**

**端点：** `GET /admin`

**描述：** 返回管理后台 API 信息

**认证：** 不需要

**请求示例：**
```bash
curl http://123.56.17.118:3000/admin
```

**响应示例：**
```json
{
  "success": true,
  "message": "管理后台 API",
  "version": "1.0.0",
  "endpoints": {
    "stats": "GET /admin/stats - 获取统计数据",
    "users": "GET /admin/users - 获取用户列表",
    "affirmations": "GET /admin/affirmations - 获取肯定语列表",
    "logs": "GET /admin/logs - 获取日志"
  }
}
```

---

### 2. **获取统计数据**

**端点：** `GET /admin/stats`

**描述：** 获取系统统计数据（用户数、肯定语数、收藏数、愿景板数）

**认证：** 需要（JWT Token）

**请求示例：**
```bash
curl http://123.56.17.118:3000/admin/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "users": 100,
    "affirmations": 50,
    "favorites": 200,
    "visionBoards": 30
  }
}
```

---

### 3. **获取用户列表**

**端点：** `GET /admin/users`

**描述：** 获取用户列表（分页）

**认证：** 需要（JWT Token）

**查询参数：**
- `page` (可选): 页码，默认 1
- `limit` (可选): 每页数量，默认 20

**请求示例：**
```bash
curl "http://123.56.17.118:3000/admin/users?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "phone": "18210827464",
      "nickname": "用户1",
      "avatar": "http://example.com/avatar.jpg",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

### 4. **获取肯定语列表**

**端点：** `GET /admin/affirmations`

**描述：** 获取肯定语列表（分页）

**认证：** 需要（JWT Token）

**查询参数：**
- `page` (可选): 页码，默认 1
- `limit` (可选): 每页数量，默认 20

**请求示例：**
```bash
curl "http://123.56.17.118:3000/admin/affirmations?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "标题",
      "text": "文本内容",
      "code": "001",
      "short_url": "http://localhost:5174/play?a=001",
      "category": "分类",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

---

### 5. **获取系统日志**

**端点：** `GET /admin/logs`

**描述：** 获取系统日志（当前为占位符，需要集成日志系统）

**认证：** 需要（JWT Token）

**请求示例：**
```bash
curl http://123.56.17.118:3000/admin/logs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**响应示例：**
```json
{
  "success": true,
  "message": "日志功能需要集成日志系统（如 winston、pino 等）",
  "data": []
}
```

---

## 🔐 认证方式

所有需要认证的接口都需要在请求头中包含 JWT Token：

```
Authorization: Bearer YOUR_JWT_TOKEN
```

**获取 Token：**
1. 通过 `/api/auth/login` 接口登录获取 Token
2. 将 Token 添加到请求头中

**示例：**
```bash
# 1. 登录获取 Token
TOKEN=$(curl -X POST http://123.56.17.118:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"18210827464","code":"123456"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

# 2. 使用 Token 访问管理后台接口
curl http://123.56.17.118:3000/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🧪 测试示例

### 测试 1：访问管理后台首页

```bash
curl http://123.56.17.118:3000/admin
```

**预期响应：**
```json
{
  "success": true,
  "message": "管理后台 API",
  "version": "1.0.0",
  "endpoints": {...}
}
```

### 测试 2：获取统计数据（需要认证）

```bash
# 先登录获取 Token
TOKEN=$(curl -s -X POST http://123.56.17.118:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"18210827464","code":"123456"}' \
  | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('token', ''))")

# 使用 Token 访问统计数据
curl http://123.56.17.118:3000/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📝 使用说明

### 1. **访问管理后台首页**

直接在浏览器访问：
```
http://123.56.17.118:3000/admin
```

### 2. **使用 API 接口**

所有管理后台接口都返回 JSON 格式数据，可以通过以下方式使用：

- **浏览器：** 使用浏览器开发者工具或 Postman
- **命令行：** 使用 curl 命令
- **前端应用：** 使用 fetch 或 axios

### 3. **前端集成示例**

```javascript
// 获取统计数据
const getStats = async (token) => {
  const response = await fetch('http://123.56.17.118:3000/admin/stats', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return await response.json();
};

// 获取用户列表
const getUsers = async (token, page = 1, limit = 20) => {
  const response = await fetch(
    `http://123.56.17.118:3000/admin/users?page=${page}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  return await response.json();
};
```

---

## 🚀 扩展功能

### 未来可以添加的功能：

1. **用户管理**
   - 删除用户
   - 修改用户信息
   - 禁用/启用用户

2. **肯定语管理**
   - 批量删除
   - 批量修改
   - 导出数据

3. **系统设置**
   - 修改系统配置
   - 查看系统状态
   - 备份/恢复数据

4. **日志系统**
   - 集成 winston 或 pino
   - 查看操作日志
   - 导出日志

---

## 📋 总结

**已实现的功能：**
- ✅ 管理后台首页（无需认证）
- ✅ 获取统计数据（需要认证）
- ✅ 获取用户列表（需要认证，支持分页）
- ✅ 获取肯定语列表（需要认证，支持分页）
- ✅ 日志接口占位符（需要集成日志系统）

**访问地址：**
- 管理后台首页：`http://123.56.17.118:3000/admin`
- API 基础路径：`http://123.56.17.118:3000/admin/*`

**认证要求：**
- 首页：无需认证
- 其他接口：需要 JWT Token



