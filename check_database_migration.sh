#!/bin/bash

# 🔍 检查数据库迁移状态脚本
# 用途：检查 password 字段是否已添加到 users 表

echo "🔍 检查数据库迁移状态..."
echo ""

# 配置
API_BASE="http://123.56.17.118:3000/api"
PHONE="18210827464"

echo "📋 方法 1: 通过接口检查..."
echo ""

# 尝试获取一个无效 token 来测试接口
TEST_RESPONSE=$(curl -s -X POST "$API_BASE/auth/update-password" \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"test123"}')

echo "接口响应: $TEST_RESPONSE"
echo ""

if echo "$TEST_RESPONSE" | grep -q '"error":"密码功能暂未启用"'; then
    echo "❌ 数据库迁移未完成"
    echo ""
    echo "📋 需要执行数据库迁移："
    echo "   1. 登录阿里云 RDS 控制台"
    echo "   2. 进入数据管理（DMS）"
    echo "   3. 执行 SQL："
    echo ""
    echo "   USE life_design;"
    echo "   ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;"
    echo ""
    echo "   4. 验证：DESCRIBE users;"
    echo ""
    exit 1
elif echo "$TEST_RESPONSE" | grep -q '"error":"token 无效或已过期"'; then
    echo "✅ 数据库迁移已完成！"
    echo ""
    echo "💡 接口返回 'token 无效或已过期' 说明："
    echo "   - 接口存在 ✅"
    echo "   - 数据库字段已添加 ✅"
    echo "   - 需要有效 Token 才能测试完整功能"
    echo ""
    echo "📋 下一步：获取有效 Token 进行完整测试"
    echo ""
    exit 0
elif echo "$TEST_RESPONSE" | grep -q '"error":"路由不存在"'; then
    echo "❌ 接口不存在"
    echo "   可能原因：后端代码未正确部署"
    echo ""
    exit 1
else
    echo "⚠️  未知状态"
    echo "   响应: $TEST_RESPONSE"
    echo ""
    exit 1
fi



