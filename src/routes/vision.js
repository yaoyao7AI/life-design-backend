import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  normalizeElementForPersistence,
  normalizeElementForResponse,
} from "./vision-element-normalizers.js";
import { normalizeUploadsUrl } from "../utils/publicUploadUrl.js";
import { monthRangeFromVisionRequest, toDateOrNull } from "../utils/visionTodoUtils.js";
import {
  bumpUnifiedTodoOrderTouch,
  ensureTodosVisionColumns,
  parseVisionBoardTodoIdFromUnifiedId,
  softDeleteUnifiedTodoForVisionBoardTodo,
  upsertUnifiedTodoFromVisionRow
} from "../utils/visionUnifiedTodoSync.js";

const router = Router();

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function getCompatField(body, primaryKey, legacyKey) {
  if (hasOwn(body, primaryKey)) return body[primaryKey];
  if (hasOwn(body, legacyKey)) return body[legacyKey];
  return undefined;
}

function getCompatFieldFromKeys(body, keys) {
  for (const key of keys) {
    if (hasOwn(body, key)) return body[key];
  }
  return undefined;
}

let visionElementColumnSetPromise;
let visionBoardColumnSetPromise;
let visionBoardTodoSchemaEnsuredPromise;

function isBase64DataUrl(value) {
  if (typeof value !== "string") return false;
  return /^data:[^;]+;base64,/i.test(value.trim());
}

function normalizeImageUrlField(body) {
  const imageUrlInput = getCompatFieldFromKeys(body || {}, ["image_url", "imageUrl"]);
  if (imageUrlInput === undefined) return { provided: false, value: undefined };
  if (imageUrlInput === null || imageUrlInput === "") return { provided: true, value: null };
  const normalized = String(imageUrlInput).trim();
  if (!normalized) return { provided: true, value: null };
  if (isBase64DataUrl(normalized)) {
    return { provided: true, invalidReason: "BASE64_NOT_ALLOWED" };
  }
  return { provided: true, value: normalized };
}

function rejectBase64Image(res) {
  return res
    .status(400)
    .json({ error: "BASE64_NOT_ALLOWED", message: "检测到 base64 图片，请先上传后仅传 image_url" });
}

async function getVisionElementColumnSet() {
  if (!visionElementColumnSetPromise) {
    visionElementColumnSetPromise = pool
      .query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'vision_elements'`
      )
      .then(([rows]) => new Set(rows.map((row) => row.COLUMN_NAME)))
      .catch((err) => {
        console.warn("[vision_elements字段探测失败，回退基础字段]", err?.message || err);
        return new Set();
      });
  }

  return visionElementColumnSetPromise;
}

async function getVisionBoardColumnSet() {
  if (!visionBoardColumnSetPromise) {
    visionBoardColumnSetPromise = pool
      .query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'vision_boards'`
      )
      .then(async ([rows]) => {
        const columnSet = new Set(rows.map((row) => row.COLUMN_NAME));

        // 自动补齐历史库缺失字段，确保详情接口可回传 background_color
        if (!columnSet.has("background_color")) {
          try {
            await pool.query(
              "ALTER TABLE vision_boards ADD COLUMN background_color VARCHAR(32) NULL AFTER thumbnail"
            );
            columnSet.add("background_color");
          } catch (alterErr) {
            const message = String(alterErr?.message || alterErr || "");
            const duplicatedColumn =
              message.includes("Duplicate column name") || alterErr?.code === "ER_DUP_FIELDNAME";
            if (duplicatedColumn) {
              columnSet.add("background_color");
            } else {
              console.warn(
                "[vision_boards自动补齐background_color失败]",
                alterErr?.message || alterErr
              );
            }
          }
        }

        return columnSet;
      })
      .catch((err) => {
        console.warn("[vision_boards字段探测失败，回退基础字段]", err?.message || err);
        return new Set();
      });
  }

  return visionBoardColumnSetPromise;
}

async function ensureVisionBoardTodoSchema() {
  if (!visionBoardTodoSchemaEnsuredPromise) {
    visionBoardTodoSchemaEnsuredPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vision_board_todos (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          vision_board_id BIGINT NOT NULL,
          title VARCHAR(200) NULL,
          content TEXT NULL,
          image_url VARCHAR(1024) NULL,
          tag VARCHAR(20) NULL,
          occur_at DATETIME(3) NULL,
          sort_order INT NOT NULL DEFAULT 0,
          linked_todo_id VARCHAR(64) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          deleted_at DATETIME(3) NULL,
          KEY idx_vbt_user_board (user_id, vision_board_id),
          KEY idx_vbt_user_board_del_sort (user_id, vision_board_id, deleted_at, sort_order),
          KEY idx_vbt_user_linked (user_id, linked_todo_id),
          KEY idx_vbt_user_updated (user_id, updated_at, id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      const [imageUrlCols] = await pool.query(
        "SHOW COLUMNS FROM vision_board_todos LIKE 'image_url'"
      );
      if (imageUrlCols.length === 0) {
        await pool.query(
          "ALTER TABLE vision_board_todos ADD COLUMN image_url VARCHAR(1024) NULL AFTER content"
        );
      }
      await ensureTodosVisionColumns(pool);
    })().catch((err) => {
      visionBoardTodoSchemaEnsuredPromise = null;
      throw err;
    });
  }

  return visionBoardTodoSchemaEnsuredPromise;
}

function formatVisionTodo(row) {
  const unifiedId = row.unified_todo_id != null ? String(row.unified_todo_id) : null;
  const parsedLegacyId = parseVisionBoardTodoIdFromUnifiedId(unifiedId);
  const legacyId = Number.isFinite(parsedLegacyId) ? parsedLegacyId : null;
  const occurAt = row.occur_at ?? row.due_at ?? null;
  return {
    id: unifiedId,
    legacy_id: legacyId,
    vision_board_id: row.vision_board_id ?? row.vision_id ?? null,
    title: row.title ?? row.content ?? "",
    content: row.content,
    image_url: row.image_url ?? null,
    tag: row.tag,
    occur_at: occurAt ? new Date(occurAt).toISOString() : null,
    sort_order: row.sort_order ?? 0,
    linked_todo_id: row.linked_todo_id ?? null,
    vision_name: row.vision_name ?? null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function parseVisionTodoIdInput(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const fromUnified = parseVisionBoardTodoIdFromUnifiedId(raw);
  if (Number.isFinite(fromUnified)) return fromUnified;
  if (/^\d+$/.test(raw)) return Number(raw);
  return null;
}

function formatBoard(board) {
  const title = board?.title ?? board?.name ?? null;
  const coverUrl = board?.cover_url ?? board?.thumbnail ?? null;
  const backgroundColor =
    board?.background_color ?? board?.backgroundColor ?? board?.bg_color ?? null;

  return {
    ...board,
    title,
    cover_url: coverUrl,
    background_color: backgroundColor,
    // 兼容期保留历史字段，确保新旧前端都可读
    name: board?.name ?? title,
    thumbnail: board?.thumbnail ?? coverUrl,
  };
}

// 所有路由都需要认证
router.use(authenticateToken);

/**
 * 获取我的愿景板列表
 * GET /api/vision
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const boardColumnSet = await getVisionBoardColumnSet();
    const hasBackgroundColorColumn = boardColumnSet.has("background_color");
    const backgroundSelect = hasBackgroundColorColumn ? ", background_color" : "";

    const [rows] = await pool.query(
      `SELECT id, user_id, name, quadrant, thumbnail, created_at${backgroundSelect}
       FROM vision_boards
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ success: true, data: rows.map(formatBoard) });
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
    const columnSet = await getVisionElementColumnSet();
    const hasScaleColumn = columnSet.has("scale");
    const selectScale = hasScaleColumn ? ", scale" : "";
    const [elements] = await pool.query(
      `SELECT id, type, content, x, y, width, height, rotation, font_size, color${selectScale}
       FROM vision_elements
       WHERE board_id = ?
       ORDER BY id ASC`,
      [id]
    );

    const board = formatBoard(boards[0]);

    res.json({
      success: true,
      data: {
        ...board,
        elements: elements.map(normalizeElementForResponse)
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
    const titleOrName = getCompatField(req.body, "title", "name");
    const coverOrThumbnail = normalizeUploadsUrl(
      getCompatField(req.body, "cover_url", "thumbnail")
    );
    if (isBase64DataUrl(coverOrThumbnail)) {
      return rejectBase64Image(res);
    }
    const backgroundColor = getCompatFieldFromKeys(req.body, [
      "background_color",
      "backgroundColor",
      "bg_color",
    ]);
    const { quadrant } = req.body;
    const boardColumnSet = await getVisionBoardColumnSet();
    const hasBackgroundColorColumn = boardColumnSet.has("background_color");

    const insertColumns = ["user_id", "name", "quadrant", "thumbnail"];
    const insertValues = [
      userId,
      titleOrName ?? null,
      quadrant ?? null,
      coverOrThumbnail ?? null,
    ];
    if (hasBackgroundColorColumn) {
      insertColumns.push("background_color");
      insertValues.push(backgroundColor ?? null);
    }

    const [result] = await pool.query(
      `INSERT INTO vision_boards (${insertColumns.join(", ")})
       VALUES (${insertColumns.map(() => "?").join(", ")})`,
      insertValues
    );

    const boardId = result.insertId;
    const [boards] = await pool.query(
      "SELECT * FROM vision_boards WHERE id = ? AND user_id = ?",
      [boardId, userId]
    );
    const board = formatBoard(boards[0] || {
      id: boardId,
      user_id: userId,
      name: titleOrName ?? null,
      quadrant: quadrant ?? null,
      thumbnail: coverOrThumbnail ?? null,
      background_color: backgroundColor ?? null,
    });

    res.json({
      success: true,
      data: board
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
    const titleOrName = getCompatField(req.body, "title", "name");
    const coverOrThumbnail = normalizeUploadsUrl(
      getCompatField(req.body, "cover_url", "thumbnail")
    );
    if (isBase64DataUrl(coverOrThumbnail)) {
      return rejectBase64Image(res);
    }
    const backgroundColor = getCompatFieldFromKeys(req.body, [
      "background_color",
      "backgroundColor",
      "bg_color",
    ]);
    const hasQuadrant = hasOwn(req.body, "quadrant");
    const hasBackgroundColor = ["background_color", "backgroundColor", "bg_color"].some(
      (key) => hasOwn(req.body, key)
    );
    const boardColumnSet = await getVisionBoardColumnSet();
    const hasBackgroundColorColumn = boardColumnSet.has("background_color");

    // 验证所有权
    const [boards] = await pool.query(
      "SELECT id FROM vision_boards WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    if (boards.length === 0) {
      return res.status(404).json({ error: "愿景板不存在" });
    }

    const setClauses = [];
    const values = [];

    if (titleOrName !== undefined) {
      setClauses.push("name = ?");
      values.push(titleOrName ?? null);
    }
    if (hasQuadrant) {
      setClauses.push("quadrant = ?");
      values.push(req.body.quadrant ?? null);
    }
    if (coverOrThumbnail !== undefined) {
      setClauses.push("thumbnail = ?");
      values.push(coverOrThumbnail ?? null);
    }
    if (hasBackgroundColor && hasBackgroundColorColumn) {
      setClauses.push("background_color = ?");
      values.push(backgroundColor ?? null);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error:
          "至少提供一个可更新字段：title/name、cover_url/thumbnail、quadrant、background_color",
      });
    }

    values.push(id);

    // 仅更新请求中携带的字段，避免未传字段被置空
    await pool.query(
      `UPDATE vision_boards SET ${setClauses.join(", ")} WHERE id = ?`,
      values
    );

    const [updatedBoards] = await pool.query(
      "SELECT * FROM vision_boards WHERE id = ? AND user_id = ?",
      [id, userId]
    );

    res.json({
      success: true,
      message: "更新成功",
      data: formatBoard(updatedBoards[0]),
    });
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

    const columnSet = await getVisionElementColumnSet();
    const hasScaleColumn = columnSet.has("scale");

    // 插入新元素
    if (elements && elements.length > 0) {
      const normalizedElements = elements.map(normalizeElementForPersistence);
      for (const el of normalizedElements) {
        if (el?.type === "image" && isBase64DataUrl(el?.content)) {
          return rejectBase64Image(res);
        }
      }
      const values = normalizedElements.map((el) => {
        const row = [
          id,
          el.type,
          el.content,
          el.x,
          el.y,
          el.width,
          el.height,
          el.rotation,
          el.font_size,
          el.color,
        ];

        if (hasScaleColumn) {
          row.push(el.scale);
        }

        return row;
      });

      const placeholderItem = hasScaleColumn
        ? "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        : "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const placeholders = values.map(() => placeholderItem).join(",");
      const flatValues = values.flat();
      const insertScale = hasScaleColumn ? ", scale" : "";

      await pool.query(
        `INSERT INTO vision_elements 
         (board_id, type, content, x, y, width, height, rotation, font_size, color${insertScale})
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

/**
 * 获取愿景板待办列表（若为空，自动补一个默认空项）
 * GET /api/vision/:id/todos
 */
router.get("/:id/todos", async (req, res) => {
  let connection;
  try {
    await ensureVisionBoardTodoSchema();
    const userId = req.userId;
    const { id: boardId } = req.params;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [boards] = await connection.query(
      "SELECT id FROM vision_boards WHERE id = ? AND user_id = ? LIMIT 1",
      [boardId, userId]
    );
    if (boards.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "VISION_BOARD_NOT_FOUND" });
    }

    const [rows] = await connection.query(
      `SELECT NULL AS id,
              t.id AS unified_todo_id,
              t.vision_id,
              t.content,
              t.tag,
              t.due_at,
              t.vision_id AS vision_board_id,
              t.content AS title,
              NULL AS image_url,
              t.due_at AS occur_at,
              0 AS sort_order,
              NULL AS linked_todo_id,
              t.created_at AS created_at,
              t.updated_at AS updated_at,
              vb.name AS vision_name
       FROM todos t
       LEFT JOIN vision_boards vb
         ON vb.id = t.vision_id
        AND vb.user_id = t.user_id
       WHERE t.user_id = ?
         AND t.source = 'vision'
         AND t.vision_id = ?
         AND t.deleted_at IS NULL
       ORDER BY t.updated_at ASC, t.id ASC`,
      [userId, boardId]
    );

    if (rows.length === 0) {
      const [insertDefault] = await connection.query(
        `INSERT INTO vision_board_todos
         (user_id, vision_board_id, title, content, image_url, tag, occur_at, sort_order, linked_todo_id)
         VALUES (?, ?, '', '', NULL, NULL, NULL, 1000, NULL)`,
        [userId, boardId]
      );
      const [defaultRows] = await connection.query(
        `SELECT id, vision_board_id, title, content, tag, occur_at, created_at, updated_at
         FROM vision_board_todos
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
        [insertDefault.insertId, userId]
      );
      if (defaultRows[0]) {
        await upsertUnifiedTodoFromVisionRow(connection, userId, defaultRows[0]);
      }
    }

    await connection.commit();
    connection.release();
    connection = null;

    const [afterRows] = await pool.query(
      `SELECT NULL AS id,
              t.id AS unified_todo_id,
              t.vision_id,
              t.content,
              t.tag,
              t.due_at,
              t.vision_id AS vision_board_id,
              t.content AS title,
              NULL AS image_url,
              t.due_at AS occur_at,
              0 AS sort_order,
              NULL AS linked_todo_id,
              t.created_at AS created_at,
              t.updated_at AS updated_at,
              vb.name AS vision_name
       FROM todos t
       LEFT JOIN vision_boards vb
         ON vb.id = t.vision_id
        AND vb.user_id = t.user_id
       WHERE t.user_id = ?
         AND t.source = 'vision'
         AND t.vision_id = ?
         AND t.deleted_at IS NULL
       ORDER BY t.updated_at ASC, t.id ASC`,
      [userId, boardId]
    );

    return res.json({
      success: true,
      data: {
        board_id: Number(boardId),
        items: afterRows.map(formatVisionTodo),
      },
    });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[获取愿景板待办列表错误]", err);
    return res.status(500).json({ error: "获取愿景板待办列表失败" });
  }
});

/**
 * 新增愿景板待办（每板最多 20 条）
 * POST /api/vision/:id/todos
 */
router.post("/:id/todos", async (req, res) => {
  let connection;
  try {
    await ensureVisionBoardTodoSchema();
    const userId = req.userId;
    const { id: boardId } = req.params;
    const content = hasOwn(req.body, "content") ? String(req.body.content ?? "") : "";
    const titleInput = hasOwn(req.body, "title") ? req.body.title : undefined;
    const title = titleInput === undefined ? content : String(titleInput ?? "");
    const imageUrl = normalizeImageUrlField(req.body);
    if (imageUrl.invalidReason === "BASE64_NOT_ALLOWED") {
      return rejectBase64Image(res);
    }
    const tag = hasOwn(req.body, "tag") ? (req.body.tag ?? null) : null;
    const occurAt = toDateOrNull(req.body?.occur_at ?? req.body?.occurAt);

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [boards] = await connection.query(
      "SELECT id FROM vision_boards WHERE id = ? AND user_id = ? LIMIT 1",
      [boardId, userId]
    );
    if (boards.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "VISION_BOARD_NOT_FOUND" });
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS cnt
       FROM vision_board_todos
       WHERE user_id = ? AND vision_board_id = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [userId, boardId]
    );
    if (Number(countRows[0]?.cnt || 0) >= 20) {
      await connection.rollback();
      return res.status(400).json({ error: "VISION_TODO_LIMIT_EXCEEDED" });
    }

    const [maxOrderRows] = await connection.query(
      `SELECT COALESCE(MAX(sort_order), 0) AS max_order
       FROM vision_board_todos
       WHERE user_id = ? AND vision_board_id = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [userId, boardId]
    );
    const nextOrder = Number(maxOrderRows[0]?.max_order || 0) + 1000;

    const [result] = await connection.query(
      `INSERT INTO vision_board_todos
       (user_id, vision_board_id, title, content, image_url, tag, occur_at, sort_order, linked_todo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [userId, boardId, title, content, imageUrl.value ?? null, tag, occurAt, nextOrder]
    );

    const [insertedVbt] = await connection.query(
      `SELECT id, vision_board_id, title, content, tag, occur_at, created_at, updated_at
       FROM vision_board_todos
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [result.insertId, userId]
    );
    if (insertedVbt[0]) {
      await upsertUnifiedTodoFromVisionRow(connection, userId, insertedVbt[0]);
    }

    await connection.commit();
    connection.release();
    connection = null;

    return res.json({
      success: true,
      data: { id: `vbt_${result.insertId}`, legacy_id: result.insertId, sort_order: nextOrder },
    });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[新增愿景板待办错误]", err);
    return res.status(500).json({ error: "新增愿景板待办失败" });
  }
});

/**
 * 更新愿景板待办
 * PUT /api/vision/:id/todos/:todoId
 */
router.put("/:id/todos/:todoId", async (req, res) => {
  let connection;
  try {
    await ensureVisionBoardTodoSchema();
    const userId = req.userId;
    const { id: boardId, todoId } = req.params;
    const legacyTodoId = parseVisionTodoIdInput(todoId);
    if (!Number.isFinite(legacyTodoId)) {
      return res.status(400).json({ error: "VISION_TODO_ID_INVALID" });
    }
    const monthRange = monthRangeFromVisionRequest(req);
    const linkedTodoId =
      hasOwn(req.body, "linked_todo_id") || hasOwn(req.body, "linkedTodoId")
        ? (req.body.linked_todo_id ?? req.body.linkedTodoId ?? null)
        : undefined;

    const setClauses = [];
    const values = [];

    if (hasOwn(req.body, "title")) {
      setClauses.push("title = ?");
      values.push(req.body.title === null ? null : String(req.body.title ?? ""));
    }
    if (hasOwn(req.body, "content")) {
      setClauses.push("content = ?");
      values.push(req.body.content === null ? null : String(req.body.content ?? ""));
    }
    const imageUrl = normalizeImageUrlField(req.body);
    if (imageUrl.invalidReason === "BASE64_NOT_ALLOWED") {
      return rejectBase64Image(res);
    }
    if (imageUrl.provided) {
      setClauses.push("image_url = ?");
      values.push(imageUrl.value ?? null);
    }
    if (hasOwn(req.body, "tag")) {
      setClauses.push("tag = ?");
      values.push(req.body.tag ?? null);
    }
    if (hasOwn(req.body, "occur_at") || hasOwn(req.body, "occurAt")) {
      const occurAt = toDateOrNull(req.body?.occur_at ?? req.body?.occurAt);
      if ((req.body?.occur_at ?? req.body?.occurAt) && !occurAt) {
        return res.status(400).json({ error: "VALIDATION_ERROR", message: "occur_at 格式不正确" });
      }
      setClauses.push("occur_at = ?");
      values.push(occurAt);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [todoRows] = await connection.query(
      `SELECT id
       FROM vision_board_todos
       WHERE id = ? AND user_id = ? AND vision_board_id = ? AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [legacyTodoId, userId, boardId]
    );
    if (todoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "VISION_TODO_NOT_FOUND" });
    }

    if (linkedTodoId !== undefined) {
      if (!linkedTodoId) {
        setClauses.push("linked_todo_id = ?");
        values.push(null);
      } else {
        const [linkedRows] = await connection.query(
          `SELECT id
           FROM todos
           WHERE user_id = ?
             AND id = ?
             AND deleted_at IS NULL
             AND due_at >= ?
             AND due_at < ?
           LIMIT 1`,
          [userId, String(linkedTodoId), monthRange.start, monthRange.end]
        );
        if (linkedRows.length === 0) {
          await connection.rollback();
          return res.status(400).json({ error: "VISION_TODO_LINKED_NOT_IN_MONTH" });
        }
        setClauses.push("linked_todo_id = ?");
        values.push(String(linkedTodoId));
      }
    }

    if (setClauses.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "没有可更新字段" });
    }

    values.push(legacyTodoId, userId, boardId);
    await connection.query(
      `UPDATE vision_board_todos
       SET ${setClauses.join(", ")}
       WHERE id = ? AND user_id = ? AND vision_board_id = ? AND deleted_at IS NULL`,
      values
    );

    const [updatedVbt] = await connection.query(
      `SELECT id, vision_board_id, title, content, tag, occur_at, created_at, updated_at
       FROM vision_board_todos
       WHERE id = ? AND user_id = ? AND vision_board_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [legacyTodoId, userId, boardId]
    );
    if (updatedVbt[0]) {
      await upsertUnifiedTodoFromVisionRow(connection, userId, updatedVbt[0]);
    }

    await connection.commit();
    connection.release();
    connection = null;
    return res.json({ success: true });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[更新愿景板待办错误]", err);
    return res.status(500).json({ error: "更新愿景板待办失败" });
  }
});

/**
 * 删除愿景板待办（至少保留 1 条）
 * DELETE /api/vision/:id/todos/:todoId
 */
router.delete("/:id/todos/:todoId", async (req, res) => {
  let connection;
  try {
    await ensureVisionBoardTodoSchema();
    const userId = req.userId;
    const { id: boardId, todoId } = req.params;
    const legacyTodoId = parseVisionTodoIdInput(todoId);
    if (!Number.isFinite(legacyTodoId)) {
      return res.status(400).json({ error: "VISION_TODO_ID_INVALID" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [todoRows] = await connection.query(
      `SELECT id
       FROM vision_board_todos
       WHERE id = ? AND user_id = ? AND vision_board_id = ? AND deleted_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [legacyTodoId, userId, boardId]
    );
    if (todoRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "VISION_TODO_NOT_FOUND" });
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS cnt
       FROM vision_board_todos
       WHERE user_id = ? AND vision_board_id = ? AND deleted_at IS NULL
       FOR UPDATE`,
      [userId, boardId]
    );
    if (Number(countRows[0]?.cnt || 0) <= 1) {
      await connection.rollback();
      return res.status(400).json({ error: "VISION_TODO_MIN_ONE_REQUIRED" });
    }

    const delAt = new Date();
    await connection.query(
      `UPDATE vision_board_todos
       SET deleted_at = ?
       WHERE id = ? AND user_id = ? AND vision_board_id = ? AND deleted_at IS NULL`,
      [delAt, legacyTodoId, userId, boardId]
    );

    await softDeleteUnifiedTodoForVisionBoardTodo(connection, userId, legacyTodoId, delAt);

    await connection.commit();
    connection.release();
    connection = null;
    return res.json({ success: true });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[删除愿景板待办错误]", err);
    return res.status(500).json({ error: "删除愿景板待办失败" });
  }
});

/**
 * 拖拽排序
 * PATCH /api/vision/:id/todos/reorder
 */
router.patch("/:id/todos/reorder", async (req, res) => {
  let connection;
  try {
    await ensureVisionBoardTodoSchema();
    const userId = req.userId;
    const { id: boardId } = req.params;
    const orders = Array.isArray(req.body?.orders) ? req.body.orders : [];
    if (orders.length === 0) {
      return res.status(400).json({ error: "VISION_TODO_INVALID_REORDER_PAYLOAD" });
    }

    const ids = [];
    const sortMap = new Map();
    for (const item of orders) {
      const id = parseVisionTodoIdInput(item?.id);
      const sortOrder = Number(item?.sort_order);
      if (!Number.isInteger(id) || !Number.isInteger(sortOrder)) {
        return res.status(400).json({ error: "VISION_TODO_INVALID_REORDER_PAYLOAD" });
      }
      ids.push(id);
      sortMap.set(id, sortOrder);
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [scopeRows] = await connection.query(
      `SELECT id
       FROM vision_board_todos
       WHERE user_id = ? AND vision_board_id = ? AND deleted_at IS NULL AND id IN (?)`,
      [userId, boardId, ids]
    );
    if (scopeRows.length !== ids.length) {
      await connection.rollback();
      return res.status(400).json({ error: "VISION_TODO_REORDER_ITEM_OUT_OF_SCOPE" });
    }

    for (const id of ids) {
      await connection.query(
        `UPDATE vision_board_todos
         SET sort_order = ?
         WHERE id = ? AND user_id = ? AND vision_board_id = ? AND deleted_at IS NULL`,
        [sortMap.get(id), id, userId, boardId]
      );
    }

    for (const id of ids) {
      await bumpUnifiedTodoOrderTouch(connection, userId, id);
    }

    await connection.commit();
    connection.release();
    connection = null;
    return res.json({ success: true });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[愿景板待办排序错误]", err);
    return res.status(500).json({ error: "愿景板待办排序失败" });
  }
});

/**
 * 本月可关联 todo 列表
 * GET /api/vision/:id/todos/linkable?month=YYYY-MM
 */
router.get("/:id/todos/linkable", async (req, res) => {
  try {
    await ensureVisionBoardTodoSchema();
    const userId = req.userId;
    const { id: boardId } = req.params;
    const month = req.query.month;
    const monthRange = monthRangeFromVisionRequest(req);

    const [boards] = await pool.query(
      "SELECT id FROM vision_boards WHERE id = ? AND user_id = ? LIMIT 1",
      [boardId, userId]
    );
    if (boards.length === 0) {
      return res.status(404).json({ error: "VISION_BOARD_NOT_FOUND" });
    }

    const [rows] = await pool.query(
      `SELECT id, content, tag, due_at, completed
       FROM todos
       WHERE user_id = ?
         AND deleted_at IS NULL
         AND due_at >= ?
         AND due_at < ?
       ORDER BY due_at ASC, id ASC`,
      [userId, monthRange.start, monthRange.end]
    );

    return res.json({
      success: true,
      data: {
        month: typeof month === "string" && month ? month : null,
        items: rows.map((r) => ({
          id: r.id,
          content: r.content,
          tag: r.tag ?? null,
          due_at: r.due_at ? new Date(r.due_at).toISOString() : null,
          completed: !!r.completed,
        })),
      },
    });
  } catch (err) {
    console.error("[获取本月可关联 todo 列表错误]", err);
    return res.status(500).json({ error: "获取本月可关联 todo 列表失败" });
  }
});

/**
 * 关键行动联动查询（按分类 + 月份）
 * GET /api/vision/actions/linked-todos?tag=work&month=YYYY-MM
 */
router.get("/actions/linked-todos", async (req, res) => {
  try {
    await ensureVisionBoardTodoSchema();
    const userId = req.userId;
    const tag = hasOwn(req.query, "tag") ? String(req.query.tag || "").trim() : "";
    const monthRange = monthRangeFromVisionRequest(req);

    const whereTag = tag ? "AND vbt.tag = ?" : "";
    const params = [userId, monthRange.start, monthRange.end];
    if (tag) params.push(tag);

    const [rows] = await pool.query(
      `SELECT vbt.id, vbt.title, vbt.content, vbt.tag, vbt.occur_at, vbt.sort_order,
              vb.id AS vision_board_id, vb.name AS vision_board_name
       FROM vision_board_todos vbt
       JOIN vision_boards vb ON vb.id = vbt.vision_board_id
       WHERE vbt.user_id = ?
         AND vbt.deleted_at IS NULL
         AND (vbt.occur_at IS NULL OR (vbt.occur_at >= ? AND vbt.occur_at < ?))
         ${whereTag}
       ORDER BY vbt.sort_order ASC, vbt.id ASC`,
      params
    );

    return res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        content: r.content,
        tag: r.tag,
        occur_at: r.occur_at ? new Date(r.occur_at).toISOString() : null,
        sort_order: r.sort_order,
        vision_board_id: r.vision_board_id,
        vision_board_name: r.vision_board_name,
      })),
    });
  } catch (err) {
    console.error("[关键行动联动待办查询错误]", err);
    return res.status(500).json({ error: "关键行动联动待办查询失败" });
  }
});

export default router;
