#!/bin/bash

# 更新数据库配置脚本
# 使用方法：在服务器上执行此脚本

echo "🔧 更新数据库配置..."

# 进入项目目录
cd /root/life-design-backend || exit 1

# 备份现有配置
if [ -f .env ]; then
    cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份现有配置"
fi

# 更新数据库配置
cat > .env << 'EOF'
DB_HOST=rm-2ze0yppdih8t4t4e4.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=life_design_user
DB_PASS=YOUR_DB_PASSWORD
DB_NAME=life_design
EOF

echo "✅ 数据库配置已更新"

# 重启后端服务
echo "🔄 重启后端服务..."
pm2 restart life-design-backend

# 等待服务启动
sleep 3

# 查看日志
echo "📋 查看服务日志..."
pm2 logs life-design-backend --lines 20 --nostream

echo ""
echo "✅ 配置更新完成！"
echo ""
echo "📋 下一步："
echo "1. 检查日志是否有错误"
echo "2. 测试登录功能"
echo "3. 如果还有问题，检查白名单配置"

