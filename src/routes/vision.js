import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * 获取我的愿景板列表
 * GET /api/vision
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;

    const [rows] = await pool.query(
      `SELECT id, name, quadrant, thumbnail, created_at
       FROM vision_boards
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("[获取愿景板列表错误]", err);
    res.status(500).json({ error: "获取愿景板列表失败" });
  }
});

/**
 * 获取单个愿景板详情（包含元素）
 * GET /api/vision/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // 获取愿景板信息
    const [boards] = await pool.query(
      "SELECT * FROM vision_boards WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (boards.length === 0) {
      return res.status(404).json({ error: "愿景板不存在" });
    }

    // 获取愿景板元素
    const [elements] = await pool.query(
      `SELECT id, type, content, x, y, width, height, rotation, font_size, color
       FROM vision_elements
       WHERE board_id = ?
       ORDER BY id ASC`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...boards[0],
        elements: elements
      }
    });
  } catch (err) {
    console.error("[获取愿景板详情错误]", err);
    res.status(500).json({ error: "获取愿景板详情失败" });
  }
});

/**
 * 创建新愿景板
 * POST /api/vision
 */
router.post("/", async (req, res) => {
  try {
    const userId = req.userId;
    const { name, quadrant, thumbnail } = req.body;

    const [result] = await pool.query(
      "INSERT INTO vision_boards (user_id, name, quadrant, thumbnail) VALUES (?, ?, ?, ?)",
      [userId, name || null, quadrant || null, thumbnail || null]
    );

    const boardId = result.insertId;

    res.json({
      success: true,
      data: {
        id: boardId,
        user_id: userId,
        name,
        quadrant,
        thumbnail
      }
    });
  } catch (err) {
    console.error("[创建愿景板错误]", err);
    res.status(500).json({ error: "创建愿景板失败" });
  }
});

/**
 * 更新愿景板
 * PUT /api/vision/:id
 */
router.put("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { name, quadrant, thumbnail } = req.body;

    // 验证所有权
    const [boards] = await pool.query(
      "SELECT id FROM vision_boards WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (boards.length === 0) {
      return res.status(404).json({ error: "愿景板不存在" });
    }

    // 更新
    await pool.query(
      "UPDATE vision_boards SET name = ?, quadrant = ?, thumbnail = ? WHERE id = ?",
      [name || null, quadrant || null, thumbnail || null, id]
    );

    res.json({ success: true, message: "更新成功" });
  } catch (err) {
    console.error("[更新愿景板错误]", err);
    res.status(500).json({ error: "更新愿景板失败" });
  }
});

/**
 * 删除愿景板
 * DELETE /api/vision/:id
 */
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // 验证所有权
    const [boards] = await pool.query(
      "SELECT id FROM vision_boards WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (boards.length === 0) {
      return res.status(404).json({ error: "愿景板不存在" });
    }

    // 删除元素（外键约束会自动处理，但显式删除更清晰）
    await pool.query("DELETE FROM vision_elements WHERE board_id = ?", [id]);

    // 删除愿景板
    await pool.query("DELETE FROM vision_boards WHERE id = ?", [id]);

    res.json({ success: true, message: "删除成功" });
  } catch (err) {
    console.error("[删除愿景板错误]", err);
    res.status(500).json({ error: "删除愿景板失败" });
  }
});

/**
 * 保存愿景板元素
 * POST /api/vision/:id/elements
 */
router.post("/:id/elements", async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { elements } = req.body; // elements 是数组

    // 验证愿景板所有权
    const [boards] = await pool.query(
      "SELECT id FROM vision_boards WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (boards.length === 0) {
      return res.status(404).json({ error: "愿景板不存在" });
    }

    // 删除旧元素
    await pool.query("DELETE FROM vision_elements WHERE board_id = ?", [id]);

    // 插入新元素
    if (elements && elements.length > 0) {
      const values = elements.map(el => [
        id,
        el.type || 'text',
        el.content || null,
        el.x || 0,
        el.y || 0,
        el.width || null,
        el.height || null,
        el.rotation || 0,
        el.font_size || null,
        el.color || null
      ]);

      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(',');
      const flatValues = values.flat();

      await pool.query(
        `INSERT INTO vision_elements 
         (board_id, type, content, x, y, width, height, rotation, font_size, color)
         VALUES ${placeholders}`,
        flatValues
      );
    }

    res.json({ success: true, message: "保存成功" });
  } catch (err) {
    console.error("[保存愿景板元素错误]", err);
    res.status(500).json({ error: "保存失败" });
  }
});

export default router;
