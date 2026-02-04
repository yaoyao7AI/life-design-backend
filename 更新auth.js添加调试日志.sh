#!/bin/bash
# 更新 auth.js，添加详细的调试日志

cd /root/apps/life-design-backend || exit 1

# 备份
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)

echo "✅ 备份完成"
echo ""
echo "请手动编辑文件，添加调试日志"
echo "或者使用以下命令查看需要修改的部分："
echo ""
echo "  nano src/routes/auth.js"
echo ""
echo "找到登录路由的 try 块，添加调试日志"

