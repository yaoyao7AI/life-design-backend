# 🧪 完整测试指南 - 修改密码功能

## 🎯 测试目标

验证修改密码功能是否正常工作，包括：
1. 接口是否存在
2. 数据库迁移是否完成
3. 功能是否正常

---

## 📋 测试步骤

### 步骤 1：检查接口是否存在

**测试命令：**
```bash
curl -X POST http://123.56.17.118:3000/api/auth/update-password \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"test123"}'
```

**预期响应：**

**情况 A：数据库迁移未完成**
```json
{
  "error": "密码功能暂未启用",
  "message": "数据库表需要添加 password 字段"
}
```
👉 **说明：** 需要执行数据库迁移

**情况 B：数据库迁移已完成，但 Token 无效**
```json
{
  "error": "token 无效或已过期"
}
```
👉 **说明：** 接口存在，需要有效的 Token

**情况 C：接口不存在**
```json
{
  "error": "路由不存在"
}
```
👉 **说明：** 后端代码未正确部署

---

### 步骤 2：获取有效的 Token

**2.1 发送验证码**
```bash
curl -X POST http://123.56.17.118:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"18210827464"}'
```

**预期响应：**
```json
{
  "success": true,
  "msg": "验证码发送成功"
}
```

**2.2 查看验证码（开发环境）**
```bash
curl http://123.56.17.118:3000/api/auth/debug-code/18210827464
```

**预期响应：**
```json
{
  "code": "123456",
  "expires": "2025-12-22T15:30:00.000Z"
}
```

**2.3 登录获取 Token**
```bash
curl -X POST http://123.56.17.118:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"18210827464","code":"YOUR_CODE"}'
```

**预期响应：**
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

### 步骤 3：测试修改密码接口

**3.1 使用有效 Token 测试**
```bash
TOKEN="YOUR_TOKEN_HERE"

curl -X POST http://123.56.17.118:3000/api/auth/update-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"newpass123"}'
```

**预期响应：**

**如果数据库迁移已完成：**
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

**如果数据库迁移未完成：**
```json
{
  "error": "密码功能暂未启用",
  "message": "数据库表需要添加 password 字段"
}
```

---

### 步骤 4：验证密码已保存

**4.1 检查数据库（如果可以直接访问）**
```sql
SELECT id, phone, password FROM users WHERE phone = '18210827464';
```

**预期结果：**
- `password` 字段应该有值（当前是明文存储）

---

## 🔍 测试检查清单

### 接口测试
- [ ] 接口存在（返回 401 或 501，不是 404）
- [ ] Token 验证正常（无效 Token 返回 401）
- [ ] 参数验证正常（空密码返回 400）
- [ ] 密码长度验证正常（少于6位返回 400）

### 数据库迁移
- [ ] password 字段已添加
- [ ] 字段类型正确（VARCHAR(255)）
- [ ] 字段允许 NULL

### 功能测试
- [ ] 修改密码成功
- [ ] 密码已保存到数据库
- [ ] 前端可以调用接口

---

## 🚨 常见问题排查

### 问题 1：接口返回 404

**原因：** 后端代码未正确部署

**解决：**
```bash
# 检查服务状态
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118
pm2 status
pm2 logs life-design-backend

# 重新部署
cd /root/apps/life-design-backend
pm2 restart life-design-backend
```

---

### 问题 2：接口返回 501

**原因：** 数据库迁移未完成

**解决：**
1. 登录阿里云 RDS 控制台
2. 执行 SQL：
   ```sql
   USE life_design;
   ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;
   ```
3. 验证字段已添加：
   ```sql
   DESCRIBE users;
   ```

---

### 问题 3：接口返回 401

**原因：** Token 无效或已过期

**解决：**
1. 重新登录获取新的 Token
2. 检查 Token 是否正确传递
3. 检查 Authorization 头格式：`Bearer <token>`

---

### 问题 4：接口返回 400

**可能原因：**
- 密码为空
- 密码长度少于6位

**解决：**
- 确保密码不为空
- 确保密码长度至少6位

---

## 📝 完整测试脚本

已创建测试脚本：`test_update_password.sh`

**使用方法：**
```bash
cd /Users/mac/Desktop/life-design-backend
./test_update_password.sh
```

**脚本功能：**
1. 自动登录获取 Token
2. 测试修改密码接口
3. 显示详细的测试结果

---

## 🎯 快速测试命令

### 一键测试（需要先获取验证码）

```bash
# 1. 发送验证码
curl -X POST http://123.56.17.118:3000/api/auth/send-code \
  -H "Content-Type: application/json" \
  -d '{"phone":"18210827464"}'

# 2. 查看验证码（开发环境）
curl http://123.56.17.118:3000/api/auth/debug-code/18210827464

# 3. 登录获取 Token
TOKEN=$(curl -s -X POST http://123.56.17.118:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"18210827464","code":"YOUR_CODE"}' \
  | jq -r '.token')

# 4. 测试修改密码
curl -X POST http://123.56.17.118:3000/api/auth/update-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"newpass123"}'
```

---

## ✅ 测试成功标准

### 接口测试成功
- ✅ 接口返回 200 状态码
- ✅ 响应包含 `{"success": true, "message": "密码修改成功"}`
- ✅ 数据库中的 password 字段有值

### 功能测试成功
- ✅ 前端可以调用接口
- ✅ 修改密码功能正常工作
- ✅ 用户可以使用新密码（如果实现了密码登录）

---

## 📋 测试报告模板

```
测试时间：2025-12-22
测试人员：XXX

接口测试：
- [ ] 接口存在
- [ ] Token 验证正常
- [ ] 参数验证正常
- [ ] 功能正常

数据库迁移：
- [ ] password 字段已添加
- [ ] 字段类型正确

功能测试：
- [ ] 修改密码成功
- [ ] 密码已保存

问题记录：
1. ...
2. ...

测试结论：
✅ 通过 / ❌ 失败
```

---

**测试完成后，记得记录测试结果！** 🎯



