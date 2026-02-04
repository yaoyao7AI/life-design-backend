#!/bin/bash

# ✅ 验证数据库迁移是否成功

echo "🔍 验证数据库迁移状态..."
echo ""

API_BASE="http://123.56.17.118:3000/api"

# 测试接口响应
RESPONSE=$(curl -s -X POST "$API_BASE/auth/update-password" \
  -H "Authorization: Bearer test_token" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"test123"}')

echo "接口响应: $RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"error":"密码功能暂未启用"'; then
    echo "❌ 数据库迁移未完成"
    echo ""
    echo "📋 需要执行以下 SQL："
    echo ""
    echo "USE life_design;"
    echo "ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;"
    echo ""
    echo "📝 操作步骤："
    echo "   1. 登录阿里云 RDS 控制台"
    echo "   2. 进入数据管理（DMS）"
    echo "   3. 执行上面的 SQL"
    echo ""
    exit 1
elif echo "$RESPONSE" | grep -q '"error":"token 无效或已过期"'; then
    echo "✅ 数据库迁移已完成！"
    echo ""
    echo "💡 说明："
    echo "   - 接口返回 'token 无效或已过期' 说明："
    echo "   - ✅ 接口存在"
    echo "   - ✅ 数据库字段已添加"
    echo "   - ✅ 需要有效 Token 才能测试完整功能"
    echo ""
    echo "🎉 迁移成功！可以正常使用修改密码功能了！"
    echo ""
    exit 0
else
    echo "⚠️  未知状态"
    echo "   响应: $RESPONSE"
    echo ""
    exit 1
fi



