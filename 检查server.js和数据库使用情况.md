# 🔍 检查 server.js 和数据库使用情况

## ✅ 检查结果

- ✅ **所有路由文件都使用 `src/db.js`**（正确）
- ⚠️ **存在 `src/config/database.js`**（使用不同的环境变量名）

---

## 🔍 步骤 2：检查 server.js 和数据库使用情况

### 在服务器上执行：

```bash
cd /root/apps/life-design-backend

# 1. 检查 server.js 内容
echo "=== 1. 检查 server.js ==="
cat src/server.js

# 2. 检查是否有文件使用 src/config/database.js
echo ""
echo "=== 2. 检查是否有文件使用 src/config/database.js ==="
grep -r "config/database\|config.*database" src/ --include="*.js" | grep -v node_modules

# 3. 检查环境变量是否正确加载
echo ""
echo "=== 3. 检查环境变量 ==="
cat .env | grep -E "DB_|MYSQL_"

# 4. 测试环境变量加载
echo ""
echo "=== 4. 测试环境变量加载 ==="
node -e "require('dotenv').config(); console.log('DB_HOST:', process.env.DB_HOST);"
```

---

## 🎯 一键检查命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 1. 检查 server.js ===" && \
cat src/server.js && \
echo "" && \
echo "=== 2. 检查是否有文件使用 src/config/database.js ===" && \
grep -r "config/database\|config.*database" src/ --include="*.js" | grep -v node_modules || echo "未找到使用 config/database.js 的文件" && \
echo "" && \
echo "=== 3. 检查环境变量 ===" && \
cat .env | grep -E "DB_|MYSQL_" && \
echo "" && \
echo "=== 4. 测试环境变量加载 ===" && \
node -e "require('dotenv').config(); console.log('DB_HOST:', process.env.DB_HOST);"
```

---

## 📋 操作清单

- [x] 检查所有数据库配置文件
- [ ] 检查 server.js
- [ ] 检查是否有文件使用 src/config/database.js
- [ ] 测试环境变量加载

---

**现在执行上面的检查命令！** 🔍

