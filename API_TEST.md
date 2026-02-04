# 🔐 认证 API 测试文档

## ✅ 已实现的 API 端点

### 1. 发送验证码
**POST** `/api/auth/send-code`

**请求体：**
```json
{
  "phone": "13800138000"
}
```

**响应：**
```json
{
  "success": true,
  "message": "验证码已发送（调试模式）"
}
```

**说明：** 验证码会打印到服务器控制台，开发环境可通过 `/api/auth/debug-code/:phone` 获取。

---

### 2. 手机号 + 验证码登录
**POST** `/api/auth/login`

**请求体：**
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**响应：**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "userId": 1
}
```

**说明：** 
- 如果用户不存在，会自动注册新用户
- Token 有效期为 7 天

---

### 3. 获取用户信息
**GET** `/api/auth/me`

**请求头：**
```
Authorization: Bearer <token>
```

**响应：**
```json
{
  "data": {
    "id": 1,
    "phone": "13800138000",
    "nickname": null,
    "avatar": null
  }
}
```

**错误响应（未登录）：**
```json
{
  "error": "未登录"
}
```

**错误响应（Token 过期）：**
```json
{
  "error": "登录已过期"
}
```

---

## 🧪 测试命令示例

### 1. 发送验证码
```bash
curl -X POST http://localhost:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000"}'
```

### 2. 获取验证码（开发环境）
```bash
curl http://localhost:3000/api/auth/debug-code/13800138000
```

### 3. 登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'
```

### 4. 获取用户信息
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <your_token>"
```

---

## ✅ 测试结果

- ✅ 发送验证码 API 正常工作
- ✅ 登录 API 正常工作（自动注册新用户）
- ✅ JWT Token 生成成功
- ✅ 获取用户信息 API 正常工作
- ✅ Token 验证中间件正常工作
- ✅ 错误处理正常（未登录、Token 过期等）

---

## 🎉 完成的功能

- ✅ 中国手机号体系
- ✅ 验证码登录（开发模式：控制台打印）
- ✅ JWT 鉴权
- ✅ 自动注册用户
- ✅ 获取个人资料
- ✅ Token 验证中间件

**这一模块已正式替代 Supabase Auth！**



