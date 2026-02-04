#!/bin/bash

# 🧪 测试修改密码接口脚本

echo "🧪 开始测试修改密码接口..."
echo ""

# 配置
API_BASE="http://123.56.17.118:3000/api"
PHONE="18210827464"
CODE="123456"

echo "📋 步骤 1: 登录获取 Token..."
echo "请求: POST $API_BASE/auth/login"
echo "参数: phone=$PHONE, code=$CODE"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")

echo "响应: $LOGIN_RESPONSE"
echo ""

# 提取 token
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，无法获取 Token"
    echo "可能原因："
    echo "  1. 验证码错误或已过期"
    echo "  2. 用户不存在"
    echo "  3. 服务器错误"
    echo ""
    echo "💡 提示：可以先调用发送验证码接口获取新的验证码"
    exit 1
fi

echo "✅ 登录成功"
echo "Token: ${TOKEN:0:50}..."
echo ""

echo "📋 步骤 2: 测试修改密码接口..."
echo "请求: POST $API_BASE/auth/update-password"
echo "参数: newPassword=test123456"
echo ""

UPDATE_RESPONSE=$(curl -s -X POST "$API_BASE/auth/update-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"test123456"}')

echo "响应: $UPDATE_RESPONSE"
echo ""

# 检查响应
if echo "$UPDATE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 修改密码成功！"
    echo ""
    echo "🎉 功能正常工作！"
elif echo "$UPDATE_RESPONSE" | grep -q '"error":"密码功能暂未启用"'; then
    echo "⚠️  数据库迁移未完成"
    echo ""
    echo "📋 需要执行数据库迁移："
    echo "   1. 登录阿里云 RDS 控制台"
    echo "   2. 执行 SQL: ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;"
    echo "   3. 验证: DESCRIBE users;"
elif echo "$UPDATE_RESPONSE" | grep -q '"error":"未登录"'; then
    echo "❌ Token 无效或已过期"
    echo "   请重新登录获取新的 Token"
elif echo "$UPDATE_RESPONSE" | grep -q '"error":"新密码不能为空"'; then
    echo "❌ 密码不能为空"
elif echo "$UPDATE_RESPONSE" | grep -q '"error":"密码长度至少6位"'; then
    echo "❌ 密码长度至少6位"
else
    echo "❌ 未知错误"
    echo "   响应: $UPDATE_RESPONSE"
fi

echo ""
echo "📋 测试完成！"



