#!/bin/bash
# 更新 auth.js 文件，将 pool.query() 改为使用 getConnection() 方式

cd /root/apps/life-design-backend || exit 1

# 备份原文件
cp src/routes/auth.js src/routes/auth.js.backup.$(date +%Y%m%d_%H%M%S)
echo "✅ 备份完成"

# 使用 Python 脚本进行替换（如果服务器有 Python）
if command -v python3 &> /dev/null; then
    echo "=== 使用 Python 更新文件 ==="
    python3 << 'PYTHON_SCRIPT'
import re

# 读取文件
with open('src/routes/auth.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找并替换登录路由中的查询部分
# 匹配从 "try {" 开始到 "// 生成 JWT token" 之前的部分
pattern = r'(  try \{\s+// 查用户是否存在\s+const \[rows\] = await )pool\.query\("SELECT \* FROM users WHERE phone = \?", \[phone\]\);(.*?if \(rows\.length === 0\) \{\s+// 创建新用户\s+const \[result\] = await )pool\.query\("INSERT INTO users \(phone\) VALUES \(\?\)", \[phone\]\);(.*?userId = rows\[0\]\.id;\s+\}\s+// 生成 JWT token)'

replacement = r'''  try {
    // 获取连接
    const connection = await pool.getConnection();
    console.log('[登录] 获取连接成功');
    
    try {
      // 查用户是否存在
      const [rows] = await connection.query("SELECT * FROM users WHERE phone = ?", [phone]);

      let userId;

      if (rows.length === 0) {
        // 创建新用户
        const [result] = await connection.query("INSERT INTO users (phone) VALUES (?)", [phone]);
        userId = result.insertId;
      } else {
        userId = rows[0].id;
      }
      
      // 释放连接
      connection.release();

      // 生成 JWT token'''

# 执行替换
new_content = re.sub(
    r'  try \{\s+// 查用户是否存在\s+const \[rows\] = await pool\.query\("SELECT \* FROM users WHERE phone = \?", \[phone\]\);\s+let userId;\s+if \(rows\.length === 0\) \{\s+// 创建新用户\s+const \[result\] = await pool\.query\("INSERT INTO users \(phone\) VALUES \(\?\)", \[phone\]\);\s+userId = result\.insertId;\s+\} else \{\s+userId = rows\[0\]\.id;\s+\}\s+// 生成 JWT token',
    replacement,
    content,
    flags=re.DOTALL
)

# 添加错误处理
new_content = re.sub(
    r'(    res\.json\(\{\s+success: true,\s+token,\s+user: \{ id: userId, phone \}\s+\}\);\s+\}) catch \(err\) \{',
    r'''    res.json({
      success: true,
      token,
      user: { id: userId, phone }
    });
    } catch (queryErr) {
      // 如果查询出错，释放连接
      connection.release();
      throw queryErr;
    }
  } catch (err) {''',
    new_content,
    flags=re.DOTALL
)

# 写回文件
with open('src/routes/auth.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('✅ 文件已更新')
PYTHON_SCRIPT

    if [ $? -eq 0 ]; then
        echo "✅ 文件更新成功"
    else
        echo "❌ Python 脚本执行失败，请手动编辑文件"
        exit 1
    fi
else
    echo "❌ 服务器没有 Python3，请手动编辑文件"
    echo ""
    echo "执行以下命令手动编辑："
    echo "  nano src/routes/auth.js"
    echo ""
    echo "然后按照说明修改第 73-102 行"
    exit 1
fi

# 验证修改
echo ""
echo "=== 验证修改 ==="
if grep -q "getConnection" src/routes/auth.js; then
    echo "✅ 找到 getConnection，修改可能成功"
    grep -n "getConnection\|connection.query" src/routes/auth.js | head -5
else
    echo "⚠️  未找到 getConnection，请检查修改是否成功"
fi

echo ""
echo "=== 重启服务 ==="
pm2 restart life-design-backend --update-env
sleep 5
pm2 logs life-design-backend --lines 30 --nostream | grep -E "\[登录\]|ETIMEDOUT|登录错误"

