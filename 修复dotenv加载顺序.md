# 🔧 修复 dotenv 加载顺序

## ❌ 问题

**`server.js` 中 `dotenv.config()` 在导入 `app.js` 之后执行！**

**当前顺序（错误）：**
```javascript
import dotenv from "dotenv";
import app from "./app.js";  // ← 先导入 app.js

dotenv.config();  // ← 然后才加载环境变量
```

**问题：**
- 当 `app.js` 被导入时，环境变量还没有加载
- `app.js` → 路由 → `db.js` → 创建连接池时，环境变量可能还是旧的或未定义

---

## ✅ 解决方案：调整导入顺序

**需要先加载环境变量，再导入其他模块！**

---

## 🔧 修复步骤

### 在服务器上执行：

```bash
cd /root/apps/life-design-backend

# 备份 server.js
cp src/server.js src/server.js.backup.$(date +%Y%m%d_%H%M%S)

# 修复 server.js（先加载 dotenv，再导入其他模块）
cat > src/server.js << 'EOF'
import dotenv from "dotenv";

// 必须先加载环境变量，再导入其他模块
dotenv.config();

import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
EOF

# 验证修改
cat src/server.js

# 重启服务
pm2 restart life-design-backend --update-env

# 等待并查看日志
sleep 5
pm2 logs life-design-backend --lines 20 --nostream
```

---

## 🎯 一键修复命令（推荐）

**复制以下全部命令，一次性执行：**

```bash
cd /root/apps/life-design-backend && \
echo "=== 备份 server.js ===" && \
cp src/server.js src/server.js.backup.$(date +%Y%m%d_%H%M%S) && \
echo "✅ 已备份" && \
echo "" && \
echo "=== 修复 server.js ===" && \
cat > src/server.js << 'EOF'
import dotenv from "dotenv";

// 必须先加载环境变量，再导入其他模块
dotenv.config();

import app from "./app.js";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
EOF
echo "✅ server.js 已修复" && \
echo "" && \
echo "=== 验证修改 ===" && \
cat src/server.js && \
echo "" && \
echo "=== 重启服务 ===" && \
pm2 restart life-design-backend --update-env && \
sleep 5 && \
echo "" && \
echo "=== 查看日志 ===" && \
pm2 logs life-design-backend --lines 20 --nostream
```

---

## ✅ 执行后检查

**修复后，日志应该显示：**
- ✅ 没有 `ENOTFOUND` 错误
- ✅ 没有数据库连接错误
- ✅ 服务正常运行
- ✅ 数据库连接成功

---

## 📋 操作清单

- [ ] 备份 server.js
- [ ] 修复 server.js（调整 dotenv 加载顺序）
- [ ] 验证修改
- [ ] 重启服务
- [ ] 查看日志确认

---

**现在执行上面的修复命令！** 🚀

