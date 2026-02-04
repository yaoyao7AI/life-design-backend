# 📤 文件上传 API 文档

## ✅ 已实现的功能

### POST /api/upload

**功能：** 文件上传接口，支持头像、愿景板图片和封面图上传

---

## 📋 API 详情

### 请求

**URL:** `POST /api/upload`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Body (FormData):**
- `file` (File, 必需) - 要上传的文件
- `type` (String, 必需) - 文件类型，可选值：
  - `"avatar"` - 用户头像
  - `"vision-image"` - 愿景板图片元素
  - `"vision-cover"` - 愿景板封面图
- `board_id` (Number, 可选) - 愿景板 ID（当 type 为 `vision-image` 或 `vision-cover` 时必需）

---

### 响应

**成功响应：**
```json
{
  "success": true,
  "url": "http://localhost:3000/uploads/1/avatar.jpg",
  "fileUrl": "http://localhost:3000/uploads/1/avatar.jpg",
  "publicUrl": "http://localhost:3000/uploads/1/avatar.jpg"
}
```

**错误响应：**
```json
{
  "success": false,
  "error": "文件上传失败",
  "message": "仅支持图片文件（JPEG、PNG、WebP、GIF）"
}
```

---

## 📁 文件存储结构

### 存储位置

文件存储在 `uploads/` 目录下，结构如下：

```
uploads/
├── {userId}/
│   ├── avatar.jpg              # 用户头像
│   └── {boardId}/
│       ├── cover.jpg           # 愿景板封面
│       └── {timestamp}.jpg     # 愿景板图片元素
```

### 文件命名规则

- **头像：** `avatar.{ext}` - 固定文件名，新上传会覆盖旧文件
- **愿景板封面：** `cover.jpg` - 固定文件名，新上传会覆盖旧文件
- **愿景板图片元素：** `{timestamp}.jpg` - 时间戳命名，不会覆盖

---

## 🔒 安全限制

### 文件大小限制
- 最大文件大小：**10MB**

### 允许的文件类型
- `image/jpeg` (JPEG)
- `image/png` (PNG)
- `image/webp` (WebP)
- `image/gif` (GIF)

### 认证要求
- 所有上传请求都需要 JWT Token
- Token 通过 `Authorization: Bearer <token>` 头传递

---

## 🧪 测试示例

### 1. 上传头像

**使用 curl：**
```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@/path/to/avatar.jpg" \
  -F "type=avatar"
```

**使用 JavaScript (FormData)：**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('type', 'avatar');

fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
})
.then(res => res.json())
.then(data => {
  console.log('上传成功:', data.url);
});
```

---

### 2. 上传愿景板封面

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@/path/to/cover.jpg" \
  -F "type=vision-cover" \
  -F "board_id=1"
```

---

### 3. 上传愿景板图片元素

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer <your_token>" \
  -F "file=@/path/to/image.jpg" \
  -F "type=vision-image" \
  -F "board_id=1"
```

---

## 📝 使用流程

### 前端上传流程

1. **选择文件**
   ```javascript
   const fileInput = document.querySelector('input[type="file"]');
   const file = fileInput.files[0];
   ```

2. **创建 FormData**
   ```javascript
   const formData = new FormData();
   formData.append('file', file);
   formData.append('type', 'avatar'); // 或 'vision-image', 'vision-cover'
   if (boardId) {
     formData.append('board_id', boardId);
   }
   ```

3. **发送请求**
   ```javascript
   const response = await fetch('/api/upload', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${token}`
     },
     body: formData
   });
   
   const data = await response.json();
   ```

4. **保存 URL 到数据库**
   ```javascript
   if (data.success) {
     // 更新用户头像
     await updateProfile({ avatar: data.url });
     
     // 或保存到愿景板元素
     await saveVisionElement({
       type: 'image',
       content: data.url,
       // ... 其他属性
     });
   }
   ```

---

## ⚠️ 错误处理

### 常见错误

1. **未上传文件**
   ```json
   {
     "success": false,
     "error": "未上传文件"
   }
   ```

2. **文件类型不支持**
   ```json
   {
     "success": false,
     "error": "文件上传失败",
     "message": "仅支持图片文件（JPEG、PNG、WebP、GIF）"
   }
   ```

3. **文件大小超限**
   ```json
   {
     "success": false,
     "error": "文件大小超过限制",
     "message": "文件大小不能超过 10MB"
   }
   ```

4. **缺少必需参数**
   ```json
   {
     "success": false,
     "error": "文件上传失败",
     "message": "愿景板图片需要提供 board_id"
   }
   ```

5. **未认证**
   ```json
   {
     "error": "Access token required"
   }
   ```

---

## 🔧 配置说明

### 静态文件服务

文件通过 Express 静态文件服务提供访问：

```javascript
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
```

这意味着上传的文件可以通过以下 URL 访问：
- `http://localhost:3000/uploads/{userId}/avatar.jpg`
- `http://localhost:3000/uploads/{userId}/{boardId}/cover.jpg`

---

## 🚀 生产环境建议

### 1. 使用对象存储服务

建议在生产环境使用阿里云 OSS 或其他对象存储服务：

- **优点：**
  - 更好的性能和可扩展性
  - CDN 加速
  - 自动备份和冗余
  - 更低的服务器存储压力

### 2. 文件访问控制

- 添加访问权限验证
- 防止未授权访问其他用户的文件
- 考虑添加文件访问签名

### 3. 图片处理

- 自动压缩和优化图片
- 生成多种尺寸的缩略图
- 添加水印（可选）

### 4. 清理机制

- 定期清理未使用的文件
- 删除已删除用户/愿景板的关联文件

---

## ✅ 完成状态

- ✅ 文件上传路由已实现
- ✅ 文件类型验证
- ✅ 文件大小限制
- ✅ 目录自动创建
- ✅ 静态文件服务配置
- ✅ 错误处理完善
- ✅ JWT 认证集成

---

## 📚 相关文件

- `src/routes/upload.js` - 上传路由实现
- `src/app.js` - 静态文件服务配置
- `uploads/` - 文件存储目录（已添加到 .gitignore）

---

文件上传 API 已完全就绪！🎉



