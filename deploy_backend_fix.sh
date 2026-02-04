#!/bin/bash

# 🔧 后端修复部署脚本
# 用途：部署修改密码接口的修复

set -e

echo "🚀 开始部署后端修复..."

# 配置
SSH_KEY="$HOME/Desktop/ssh-keys/life-design-key.pem"
SERVER="root@123.56.17.118"
BACKEND_DIR="/root/apps/life-design-backend"
LOCAL_AUTH_FILE="src/routes/auth.js"

# 检查文件是否存在
if [ ! -f "$LOCAL_AUTH_FILE" ]; then
    echo "❌ 错误：找不到文件 $LOCAL_AUTH_FILE"
    exit 1
fi

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ 错误：找不到 SSH 密钥文件 $SSH_KEY"
    echo "请确认 SSH 密钥文件路径是否正确"
    exit 1
fi

echo "📦 步骤 1: 备份服务器上的旧文件..."
ssh -i "$SSH_KEY" "$SERVER" << 'EOF'
cd /root/apps/life-design-backend
if [ -f src/routes/auth.js ]; then
    cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 备份完成"
else
    echo "⚠️  警告：服务器上找不到 auth.js 文件"
fi
EOF

echo "📤 步骤 2: 上传修改后的文件..."
scp -i "$SSH_KEY" \
    "$LOCAL_AUTH_FILE" \
    "$SERVER:$BACKEND_DIR/src/routes/"

echo "🔄 步骤 3: 重启服务..."
ssh -i "$SSH_KEY" "$SERVER" << 'EOF'
cd /root/apps/life-design-backend
pm2 restart life-design-backend
pm2 status
EOF

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 下一步："
echo "1. 执行数据库迁移（添加 password 字段）"
echo "2. 测试修改密码接口"
echo ""
echo "🧪 测试命令："
echo "curl -X POST http://123.56.17.118:3000/api/auth/update-password \\"
echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"newPassword\":\"test123\"}'"



