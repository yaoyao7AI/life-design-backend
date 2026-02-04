import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

/**
 * 管理后台首页 - 返回管理后台信息
 * GET /admin
 */
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "管理后台 API",
    version: "1.0.0",
    endpoints: {
      stats: "GET /admin/stats - 获取统计数据",
      users: "GET /admin/users - 获取用户列表",
      affirmations: "GET /admin/affirmations - 获取肯定语列表",
      logs: "GET /admin/logs - 获取日志"
    }
  });
});

/**
 * 获取统计数据
 * GET /admin/stats
 */
router.get("/stats", authenticateToken, async (req, res) => {
  try {
    // 获取用户总数
    const [userCount] = await pool.query("SELECT COUNT(*) as count FROM users");
    
    // 获取肯定语总数
    const [affirmationCount] = await pool.query("SELECT COUNT(*) as count FROM affirmations");
    
    // 获取收藏总数
    const [favoriteCount] = await pool.query("SELECT COUNT(*) as count FROM favorites");
    
    // 获取愿景板总数
    const [visionCount] = await pool.query("SELECT COUNT(*) as count FROM vision_boards");
    
    res.json({
      success: true,
      data: {
        users: userCount[0].count,
        affirmations: affirmationCount[0].count,
        favorites: favoriteCount[0].count,
        visionBoards: visionCount[0].count
      }
    });
  } catch (err) {
    console.error("[获取统计数据错误]", err);
    res.status(500).json({ error: "获取统计数据失败" });
  }
});

/**
 * 获取用户列表
 * GET /admin/users
 */
router.get("/users", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      "SELECT id, phone, nickname, avatar, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [parseInt(limit), offset]
    );
    
    const [countResult] = await pool.query("SELECT COUNT(*) as total FROM users");
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("[获取用户列表错误]", err);
    res.status(500).json({ error: "获取用户列表失败" });
  }
});

/**
 * 获取肯定语列表（管理后台）
 * GET /admin/affirmations
 */
router.get("/affirmations", authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const [rows] = await pool.query(
      "SELECT id, title, text, code, short_url, category, created_at FROM affirmations ORDER BY id DESC LIMIT ? OFFSET ?",
      [parseInt(limit), offset]
    );
    
    const [countResult] = await pool.query("SELECT COUNT(*) as total FROM affirmations");
    const total = countResult[0].total;
    
    res.json({
      success: true,
      data: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error("[获取肯定语列表错误]", err);
    res.status(500).json({ error: "获取肯定语列表失败" });
  }
});

/**
 * 获取系统日志（简化版）
 * GET /admin/logs
 */
router.get("/logs", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "日志功能需要集成日志系统（如 winston、pino 等）",
    data: []
  });
});

export default router;



