#!/bin/bash

# 🧪 完整功能测试脚本
# 用途：测试修改密码功能的完整流程

set -e

echo "🧪 开始完整功能测试..."
echo ""

# 配置
API_BASE="http://123.56.17.118:3000/api"
PHONE="18210827464"

echo "📋 步骤 1: 发送验证码..."
SEND_CODE_RESPONSE=$(curl -s -X POST "$API_BASE/auth/send-code" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\"}")

echo "响应: $SEND_CODE_RESPONSE"
echo ""

if ! echo "$SEND_CODE_RESPONSE" | grep -q '"success":true'; then
    echo "❌ 发送验证码失败"
    exit 1
fi

echo "✅ 验证码发送成功"
echo ""

echo "📋 步骤 2: 获取验证码（开发环境）..."
sleep 2  # 等待验证码生成

DEBUG_CODE_RESPONSE=$(curl -s "$API_BASE/auth/debug-code/$PHONE")
echo "响应: $DEBUG_CODE_RESPONSE"
echo ""

CODE=$(echo "$DEBUG_CODE_RESPONSE" | grep -o '"code":"[^"]*' | cut -d'"' -f4)

if [ -z "$CODE" ] || [ "$CODE" = "null" ]; then
    echo "❌ 无法获取验证码"
    echo "   请手动查看验证码或等待验证码生成"
    exit 1
fi

echo "✅ 验证码: $CODE"
echo ""

echo "📋 步骤 3: 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"code\":\"$CODE\"}")

echo "响应: $LOGIN_RESPONSE"
echo ""

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ 登录失败，无法获取 Token"
    exit 1
fi

echo "✅ 登录成功"
echo "Token: ${TOKEN:0:50}..."
echo ""

echo "📋 步骤 4: 测试修改密码接口..."
UPDATE_PASSWORD_RESPONSE=$(curl -s -X POST "$API_BASE/auth/update-password" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"test123456"}')

echo "响应: $UPDATE_PASSWORD_RESPONSE"
echo ""

if echo "$UPDATE_PASSWORD_RESPONSE" | grep -q '"success":true'; then
    echo "✅ 修改密码成功！"
    echo ""
    echo "🎉 功能测试通过！"
    echo ""
    echo "📋 测试结果："
    echo "   ✅ 发送验证码：成功"
    echo "   ✅ 登录获取 Token：成功"
    echo "   ✅ 修改密码：成功"
    echo ""
    exit 0
elif echo "$UPDATE_PASSWORD_RESPONSE" | grep -q '"error":"密码功能暂未启用"'; then
    echo "❌ 数据库迁移未完成"
    echo ""
    echo "📋 需要执行数据库迁移："
    echo "   1. 登录阿里云 RDS 控制台"
    echo "   2. 执行 SQL: ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER phone;"
    echo ""
    exit 1
elif echo "$UPDATE_PASSWORD_RESPONSE" | grep -q '"error":"token 无效或已过期"'; then
    echo "❌ Token 无效或已过期"
    echo "   请重新登录获取新的 Token"
    exit 1
else
    echo "❌ 未知错误"
    echo "   响应: $UPDATE_PASSWORD_RESPONSE"
    exit 1
fi



