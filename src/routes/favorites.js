import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * 获取我的收藏列表
 * GET /api/favorites
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;

    const [rows] = await pool.query(
      `SELECT f.id, f.affirmation_id, f.category, f.created_at,
              a.code, a.text, a.category as affirmation_category
       FROM favorites f
       JOIN affirmations a ON f.affirmation_id = a.id
       WHERE f.user_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[获取收藏列表错误]", err);
    res.status(500).json({ error: "获取收藏列表失败" });
  }
});

/**
 * 添加收藏
 * POST /api/favorites
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.userId;
    const { affirmation_id, category } = req.body;

    if (!affirmation_id) {
      return res.status(400).json({ error: "缺少肯定语ID" });
    }

    // 检查是否已收藏
    const [existing] = await pool.query(
      "SELECT id FROM favorites WHERE user_id = ? AND affirmation_id = ?",
      [userId, affirmation_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "已收藏" });
    }

    // 添加收藏
    const [result] = await pool.query(
      "INSERT INTO favorites (user_id, affirmation_id, category) VALUES (?, ?, ?)",
      [userId, affirmation_id, category || null]
    );

    res.json({
      success: true,
      data: { id: result.insertId, affirmation_id, category }
    });
  } catch (err) {
    console.error("[添加收藏错误]", err);
    res.status(500).json({ error: "添加收藏失败" });
  }
});

/**
 * 删除收藏
 * DELETE /api/favorites/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // 验证收藏是否属于当前用户
    const [rows] = await pool.query(
      "SELECT id FROM favorites WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "收藏不存在" });
    }

    await pool.query("DELETE FROM favorites WHERE id = ?", [id]);

    res.json({ success: true, message: "删除成功" });
  } catch (err) {
    console.error("[删除收藏错误]", err);
    res.status(500).json({ error: "删除收藏失败" });
  }
});

/**
 * 检查是否已收藏
 * GET /api/favorites/check/:affirmation_id
 */
router.get("/check/:affirmation_id", async (req, res) => {
  try {
    const userId = req.userId;
    const { affirmation_id } = req.params;

    const [rows] = await pool.query(
      "SELECT id FROM favorites WHERE user_id = ? AND affirmation_id = ?",
      [userId, affirmation_id]
    );

    res.json({ success: true, isFavorite: rows.length > 0 });
  } catch (err) {
    console.error("[检查收藏错误]", err);
    res.status(500).json({ error: "检查收藏失败" });
  }
});

export default router;
