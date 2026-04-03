# 🚀 服务器部署指南

## ⚠️ 当前状态

**服务器代码：** 旧版本（只有简单的 index.js）
**本地代码：** 完整版本（包含所有功能）

需要将本地完整代码部署到服务器。

---

## 📋 部署步骤

### 方法 1：使用 SCP 同步代码（推荐）

#### 步骤 1：打包本地代码（推荐不包含 .env）

```bash
# 在本地 Mac 执行
cd ~/Desktop/life-design-backend

# 创建部署包（排除 node_modules，且不打包敏感 .env）
tar -czf deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='uploads' \
  --exclude='*.log' \
  src/ package.json package-lock.json database/ .env.example
```

#### 步骤 2：上传到服务器

```bash
scp -i ~/Desktop/ssh-keys/life-design-key.pem \
  deploy.tar.gz \
  root@123.56.17.118:/root/apps/life-design-backend/
```

#### 步骤 3：在服务器上解压和安装

```bash
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118

# 进入项目目录
cd /root/apps/life-design-backend

# 备份旧代码
mv index.js index.js.backup

# 解压新代码
tar -xzf deploy.tar.gz

# 安装依赖
npm install

# 配置环境变量（只在服务器上维护 .env / 或使用系统环境变量）
# 方式 A：在服务器创建 .env（推荐）
# cp .env.example .env && vim .env
#
# 方式 B：用系统环境变量（按你的运维习惯）

# 重启服务
pm2 restart life-design-backend
```

---

### 方法 2：直接复制文件（简单）

#### 步骤 1：在服务器上创建目录结构

```bash
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118

cd /root/apps/life-design-backend
mkdir -p src/routes src/middleware src/utils database
```

#### 步骤 2：使用 SCP 复制文件

```bash
# 复制主要文件
scp -i ~/Desktop/ssh-keys/life-design-key.pem \
  src/app.js \
  src/server.js \
  src/db.js \
  root@123.56.17.118:/root/apps/life-design-backend/src/

# 复制路由文件
scp -i ~/Desktop/ssh-keys/life-design-key.pem \
  src/routes/*.js \
  root@123.56.17.118:/root/apps/life-design-backend/src/routes/

# 复制中间件
scp -i ~/Desktop/ssh-keys/life-design-key.pem \
  src/middleware/*.js \
  root@123.56.17.118:/root/apps/life-design-backend/src/middleware/

# 复制工具文件
scp -i ~/Desktop/ssh-keys/life-design-key.pem \
  src/utils/*.js \
  root@123.56.17.118:/root/apps/life-design-backend/src/utils/

# 复制配置文件（建议只传 .env.example，在服务器上创建 .env）
scp -i ~/Desktop/ssh-keys/life-design-key.pem \
  package.json \
  .env.example \
  root@123.56.17.118:/root/apps/life-design-backend/
```

#### 步骤 3：在服务器上安装依赖和重启

```bash
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118

cd /root/apps/life-design-backend
npm install
pm2 restart life-design-backend
pm2 logs life-design-backend
```

---

## 🔧 快速部署脚本

创建一个自动化部署脚本：

```bash
#!/bin/bash
# deploy.sh

SERVER="root@123.56.17.118"
KEY="~/Desktop/ssh-keys/life-design-key.pem"
REMOTE_DIR="/root/apps/life-design-backend"
LOCAL_DIR="~/Desktop/life-design-backend"

echo "🚀 开始部署..."

# 1. 打包代码
echo "📦 打包代码..."
cd $LOCAL_DIR
tar -czf deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='uploads' \
  --exclude='*.log' \
  src/ package.json package-lock.json database/

# 2. 上传到服务器
echo "📤 上传到服务器..."
scp -i $KEY deploy.tar.gz $SERVER:$REMOTE_DIR/

# 3. 在服务器上部署
echo "🔧 在服务器上部署..."
ssh -i $KEY $SERVER << 'ENDSSH'
cd /root/apps/life-design-backend
mv index.js index.js.backup 2>/dev/null || true
tar -xzf deploy.tar.gz
npm install
pm2 restart life-design-backend
pm2 logs life-design-backend --lines 10
ENDSSH

echo "✅ 部署完成！"
```

---

## ⚠️ 重要注意事项

### 1. 环境变量配置（服务器侧）

确保服务器上的 `.env` 文件包含（可参考 `.env.example`）：

```env
DB_HOST=rm-2zec076upfs3zd44l1o.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=life_admin
DB_PASS=YOUR_DB_PASSWORD
DB_NAME=life_design

JWT_SECRET=your_secret_key_change_this_in_production

ALIYUN_ACCESS_KEY_ID=YOUR_ALIYUN_ACCESS_KEY_ID
ALIYUN_ACCESS_KEY_SECRET=YOUR_ALIYUN_ACCESS_KEY_SECRET
ALIYUN_SMS_SIGN=海口龙华陀恬雅百货商行
ALIYUN_SMS_TEMPLATE=SMS_499120253

PORT=3000
NODE_ENV=production
AUTH_DEBUG_CODE_ENABLED=0

# 生产建议：收敛 CORS，仅允许你的前端域名（逗号分隔）
# CORS_ORIGINS=https://life-design.me,https://www.life-design.me

# 默认关闭自动建表（需要时再开启）
# AUTO_MIGRATE_SYNC_SCHEMA=0
```

### 1.5 发布前数据库 DDL 权限与补列检查（本次必须）

本次 `vision_boards` 新增字段：`background_color VARCHAR(32)`。

由于代码里有运行时自动补列逻辑（`ALTER TABLE`），如果线上数据库账号没有 DDL 权限，会导致字段补齐失败并只打告警日志。  
建议发布前先手工检查并补齐，避免运行时不确定性。

```sql
-- 1) 查看当前登录账号（确认是发布用账号）
SELECT CURRENT_USER();

-- 2) 检查字段是否已存在
SHOW COLUMNS FROM vision_boards LIKE 'background_color';

-- 3) 若不存在则手工补齐（推荐在发布前执行）
ALTER TABLE vision_boards
  ADD COLUMN background_color VARCHAR(32) NULL AFTER thumbnail;

-- 4) 再次确认
SHOW COLUMNS FROM vision_boards LIKE 'background_color';
```

补充建议：
- 生产环境保持 `AUTO_MIGRATE_SYNC_SCHEMA=0`（默认关闭），由发布流程显式执行 DDL。
- 如果你必须依赖自动补列，请先确认发布账号具备 `ALTER` 权限。

### 2. PM2 配置

确保 PM2 启动的是正确的文件：

```bash
pm2 delete life-design-backend
pm2 start src/server.js --name life-design-backend
pm2 save
```

### 3. 防火墙配置

确保服务器防火墙允许 3000 端口：

```bash
# 检查防火墙
ufw status

# 如果需要开放端口
ufw allow 3000/tcp
```

---

## 🧪 验证部署

### 1. 检查服务状态

```bash
ssh -i ~/Desktop/ssh-keys/life-design-key.pem root@123.56.17.118
pm2 list
pm2 logs life-design-backend --lines 20
```

### 2. 测试 API

```bash
# 健康检查
curl http://123.56.17.118:3000/health

# 测试 CORS
curl -X OPTIONS http://123.56.17.118:3000/api/auth/send-code \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

---

## 📝 部署检查清单

- [ ] 代码已上传到服务器
- [ ] 依赖已安装（npm install）
- [ ] .env 文件已配置
- [ ] PM2 已重启
- [ ] 服务正常运行
- [ ] CORS 配置生效
- [ ] API 可以正常访问

---

部署完成后，CORS 错误应该就解决了！🎉



