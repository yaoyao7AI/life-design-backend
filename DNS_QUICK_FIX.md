# ⚡ DNS 配置快速修复

## 🚨 当前问题确认

**DNS 验证结果：**
- ❌ 主域名 A 记录：`123.56.17.118`（后端服务器 IP）
- ❌ www 子域名 CNAME：未配置或错误

**应该配置为：**
- ✅ 主域名 A 记录：`76.76.21.21`（Vercel IP）
- ✅ www 子域名 CNAME：`cname.vercel-dns.com`

---

## 🔧 快速修复步骤

### 步骤 1：登录域名注册商

访问你的域名注册商的 DNS 管理页面。

---

### 步骤 2：修改 DNS 记录

#### 修改 A 记录（主域名）

**找到并编辑：**
- **主机记录：** `@` 或 `life-design.me`
- **记录类型：** `A`
- **记录值：** `123.56.17.118` ❌ → **改为** `76.76.21.21` ✅

#### 添加/修改 CNAME 记录（www 子域名）

**添加或编辑：**
- **主机记录：** `www`
- **记录类型：** `CNAME`
- **记录值：** `cname.vercel-dns.com` ✅

---

### 步骤 3：保存并等待

1. **保存 DNS 配置**
2. **等待 5-30 分钟**（DNS 生效时间）

---

### 步骤 4：验证修复

```bash
# 检查主域名（应该返回 76.76.21.21）
dig life-design.me A +short

# 检查 www 子域名（应该返回 cname.vercel-dns.com）
dig www.life-design.me CNAME +short
```

**预期结果：**
```
76.76.21.21
cname.vercel-dns.com
```

---

### 步骤 5：清除本地 DNS 缓存

**Mac：**
```bash
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

**Windows：**
```bash
ipconfig /flushdns
```

**Linux：**
```bash
sudo systemd-resolve --flush-caches
```

---

### 步骤 6：验证 Vercel 配置

1. 登录 Vercel Dashboard
2. 进入项目 → **Settings** → **Domains**
3. 确认域名状态为 **"Valid Configuration"**

---

## 📋 修复检查清单

- [ ] A 记录已修改：`@` → `76.76.21.21`
- [ ] CNAME 记录已添加/修改：`www` → `cname.vercel-dns.com`
- [ ] DNS 记录已保存
- [ ] 等待了 5-30 分钟
- [ ] 使用 dig 验证 DNS 解析正确
- [ ] 清除了本地 DNS 缓存
- [ ] Vercel 显示域名状态为 "Valid Configuration"

---

## ✅ 修复后的预期结果

- ✅ 访问 https://life-design.me 正常
- ✅ 访问 https://www.life-design.me 正常
- ✅ 前端页面正常显示
- ✅ 所有功能正常工作

---

## ⚠️ 重要提示

**如果需要同时访问后端：**

可以添加子域名：
- `api.life-design.me` A 记录 → `123.56.17.118`（后端）

这样配置：
- ✅ 前端：`https://life-design.me` → Vercel
- ✅ 后端：`https://api.life-design.me` → 阿里云 ECS

---

## 📞 需要帮助？

如果修复后仍然无法访问，请提供：
1. DNS 配置截图
2. dig 命令输出结果
3. Vercel Domains 页面截图



