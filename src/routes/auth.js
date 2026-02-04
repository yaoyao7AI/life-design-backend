import { Router } from "express";
import { pool } from "../db.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { sendSMS } from "../utils/smsClient.js";

dotenv.config();

const router = Router();

// 临时验证码存储（后续可换 Redis）
const codeStorage = {};

// 为所有路由添加方法检查中间件（处理 405 错误）
router.use((req, res, next) => {
  // 记录请求信息用于调试
  console.log(`[路由请求] ${req.method} ${req.path}`);
  next();
});

/**
 * 发送短信验证码
 * POST /api/auth/send-code
 */
router.post("/send-code", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "手机号不能为空" });
  }

  // 生成 6 位验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  codeStorage[phone] = {
    code,
    expires: Date.now() + 5 * 60 * 1000 // 验证码 5 分钟过期
  };

  console.log("[发送验证码]", phone, code);

  // 发送真实短信
  const success = await sendSMS(phone, code);

  if (!success) {
    return res.status(500).json({ error: "短信发送失败" });
  }

  res.json({ success: true, msg: "验证码发送成功" });
});

/**
 * 登录接口（验证码登录 + 自动注册）
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  const { phone, code } = req.body;

  if (!phone || !code) {
    return res.status(400).json({ error: "缺少手机号或验证码" });
  }

  const record = codeStorage[phone];

  if (!record || record.code !== code) {
    return res.status(400).json({ error: "验证码错误" });
  }

  if (Date.now() > record.expires) {
    return res.status(400).json({ error: "验证码已过期" });
  }

  try {
    // 获取连接
    console.log('[登录] 开始获取连接...');
    const connection = await pool.getConnection();
    console.log('[登录] ✅ 获取连接成功');
    
    try {
      console.log('[登录] 开始查询用户，phone:', phone);
      // 查用户是否存在
      const [rows] = await connection.query("SELECT * FROM users WHERE phone = ?", [phone]);
      console.log('[登录] ✅ 查询用户成功，结果数量:', rows.length);

      let userId;

      if (rows.length === 0) {
        console.log('[登录] 用户不存在，创建新用户');
        // 创建新用户
        const [result] = await connection.query("INSERT INTO users (phone) VALUES (?)", [phone]);
        userId = result.insertId;
        console.log('[登录] ✅ 创建用户成功，userId:', userId);
      } else {
        userId = rows[0].id;
        console.log('[登录] 用户已存在，userId:', userId);
      }
      
      // 释放连接
      console.log('[登录] 释放连接');
      connection.release();
      console.log('[登录] ✅ 连接已释放');

      // 生成 JWT token
      const token = jwt.sign(
        { id: userId, phone },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );

      console.log('[登录] ✅ 登录成功，userId:', userId);
      res.json({
        success: true,
        token,
        user: { id: userId, phone }
      });
    } catch (queryErr) {
      console.error('[登录] ❌ 查询错误:', queryErr.code, queryErr.message);
      console.error('[登录] ❌ 查询错误堆栈:', queryErr.stack);
      // 如果查询出错，释放连接
      connection.release();
      throw queryErr;
    }
  } catch (err) {
    console.error("[登录错误]", err);
    console.error("[登录错误] 完整错误:", err.stack);
    res.status(500).json({ error: "登录失败" });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get("/me", async (req, res) => {
  const auth = req.headers.authorization;

  if (!auth) return res.status(401).json({ error: "未登录" });

  const token = auth.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.query(
      "SELECT id, phone, nickname, avatar FROM users WHERE id = ?",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("JWT 错误:", err);
    res.status(401).json({ error: "token 无效或已过期" });
  }
});

/**
 * 更新用户资料（昵称、头像）
 * PUT /api/auth/me
 */
router.put("/me", async (req, res) => {
  const auth = req.headers.authorization;

  if (!auth) return res.status(401).json({ error: "未登录" });

  const token = auth.replace("Bearer ", "");
  const { nickname, avatar } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // 更新用户资料
    const updateFields = [];
    const updateValues = [];

    if (nickname !== undefined) {
      updateFields.push("nickname = ?");
      updateValues.push(nickname);
    }

    if (avatar !== undefined) {
      updateFields.push("avatar = ?");
      updateValues.push(avatar);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "没有要更新的字段" });
    }

    updateValues.push(userId);

    await pool.query(
      `UPDATE users SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    // 返回更新后的用户信息
    const [rows] = await pool.query(
      "SELECT id, phone, nickname, avatar FROM users WHERE id = ?",
      [userId]
    );

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("更新用户资料错误:", err);
    res.status(500).json({ error: "更新用户资料失败" });
  }
});

/**
 * 修改密码
 * POST /api/auth/update-password
 * 需要认证
 */
router.post("/update-password", async (req, res) => {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).json({ error: "未登录" });
  }

  const token = auth.replace("Bearer ", "");
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: "新密码不能为空" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: "密码长度至少6位" });
  }

  try {
    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // 检查用户是否存在
    const [userRows] = await pool.query(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "用户不存在" });
    }

    // 检查 users 表是否有 password 字段
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM users LIKE 'password'"
    );

    if (columns.length === 0) {
      // 如果没有 password 字段，返回提示信息
      console.warn("[update-password] users 表没有 password 字段，需要先添加字段");
      return res.status(501).json({ 
        error: "密码功能暂未启用",
        message: "数据库表需要添加 password 字段"
      });
    }

    // TODO: 实际应用中应该对密码进行加密（bcrypt）
    // 这里暂时直接存储，生产环境需要加密
    await pool.query(
      "UPDATE users SET password = ? WHERE id = ?",
      [newPassword, userId]
    );

    res.json({ 
      success: true, 
      message: "密码修改成功" 
    });
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "token 无效或已过期" });
    }
    console.error("修改密码错误:", err);
    res.status(500).json({ error: "修改密码失败" });
  }
});

/**
 * 开发环境查看验证码（不要在生产开启）
 * GET /api/auth/debug-code/:phone
 */
if (process.env.NODE_ENV !== "production") {
  router.get("/debug-code/:phone", (req, res) => {
    const { phone } = req.params;
    const record = codeStorage[phone];
    if (record && Date.now() < record.expires) {
      res.json({ code: record.code, expires: new Date(record.expires).toISOString() });
    } else {
      res.json({ code: null, message: "验证码不存在或已过期" });
    }
  });
}

export default router;
