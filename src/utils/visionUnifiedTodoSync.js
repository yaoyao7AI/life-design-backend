import { normalizeTodoTag } from "./syncUtils.js";

export const VISION_TODO_ID_PREFIX = "vbt_";

export function unifiedTodoIdFromVisionBoardTodoId(vbtId) {
  return `${VISION_TODO_ID_PREFIX}${Number(vbtId)}`;
}

export function parseVisionBoardTodoIdFromUnifiedId(todoId) {
  const m = /^vbt_(\d+)$/.exec(String(todoId || ""));
  return m ? Number(m[1]) : null;
}

/** 与 POST /api/todos 一致：content 最长 200，非空落库 */
export function visionBoardTitleContentToTodoContent(title, content) {
  const t = title != null ? String(title).trim() : "";
  const c = content != null ? String(content).trim() : "";
  const primary = t || c;
  if (!primary) return " ";
  return primary.length > 200 ? primary.slice(0, 200) : primary;
}

let todosVisionColumnsPromise;

export function ensureTodosVisionColumns(db) {
  if (!todosVisionColumnsPromise) {
    todosVisionColumnsPromise = (async () => {
      async function addColumn(name, ddl) {
        const [rows] = await db.query("SHOW COLUMNS FROM todos LIKE ?", [name]);
        if (rows.length > 0) return;
        await db.query(`ALTER TABLE todos ADD COLUMN ${ddl}`);
      }
      await addColumn("source", "source VARCHAR(32) NULL AFTER rev");
      await addColumn("vision_id", "vision_id BIGINT UNSIGNED NULL AFTER source");
    })().catch((err) => {
      todosVisionColumnsPromise = null;
      throw err;
    });
  }
  return todosVisionColumnsPromise;
}

/**
 * 根据 vision_board_todos 一行同步到 todos（id = vbt_<vbt.id>）
 */
export async function upsertUnifiedTodoFromVisionRow(conn, userId, row) {
  const id = unifiedTodoIdFromVisionBoardTodoId(row.id);
  const content = visionBoardTitleContentToTodoContent(row.title, row.content);
  const tag = normalizeTodoTag(row.tag);
  const dueAt = row.occur_at || null;
  const createdAt = row.created_at || new Date();
  const updatedAt = row.updated_at || new Date();
  const boardId = Number(row.vision_board_id);

  const [existing] = await conn.query(
    "SELECT id FROM todos WHERE user_id = ? AND id = ? LIMIT 1",
    [userId, id]
  );

  if (!existing.length) {
    await conn.query(
      `
        INSERT INTO todos
          (user_id, id, content, tag, due_at, completed, completed_at,
           created_at, updated_at, deleted_at, client_id, last_request_id, rev, source, vision_id)
        VALUES
          (?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL, NULL, NULL, 1, 'vision', ?)
      `,
      [userId, id, content, tag, dueAt, createdAt, updatedAt, boardId]
    );
  } else {
    await conn.query(
      `
        UPDATE todos
        SET content = ?,
            tag = ?,
            due_at = ?,
            updated_at = ?,
            rev = rev + 1,
            deleted_at = NULL,
            source = 'vision',
            vision_id = ?
        WHERE user_id = ? AND id = ?
      `,
      [content, tag, dueAt, updatedAt, boardId, userId, id]
    );
  }
}

export async function softDeleteUnifiedTodoForVisionBoardTodo(conn, userId, vbtId, deletedAt) {
  const id = unifiedTodoIdFromVisionBoardTodoId(vbtId);
  const at = deletedAt || new Date();
  await conn.query(
    `
      UPDATE todos
      SET deleted_at = ?, updated_at = ?, rev = rev + 1
      WHERE user_id = ? AND id = ?
    `,
    [at, at, userId, id]
  );
}

/** 排序变更时推进统一待办的游标，便于增量拉取 */
export async function bumpUnifiedTodoOrderTouch(conn, userId, vbtId) {
  const id = unifiedTodoIdFromVisionBoardTodoId(vbtId);
  const now = new Date();
  await conn.query(
    `
      UPDATE todos
      SET updated_at = ?, rev = rev + 1
      WHERE user_id = ? AND id = ?
    `,
    [now, userId, id]
  );
}

/** POST /api/todos 更新 vbt_* 时回写愿景板表（正文与标签、日期） */
export async function mirrorUnifiedTodoToVisionRow(conn, userId, unifiedTodoId, fields) {
  const vbtId = parseVisionBoardTodoIdFromUnifiedId(unifiedTodoId);
  if (vbtId == null) return;
  const { content, tag, dueAt } = fields;
  const tagN = tag === undefined ? undefined : normalizeTodoTag(tag);
  if (content === undefined && tagN === undefined && dueAt === undefined) return;

  const setParts = [];
  const vals = [];
  if (content !== undefined) {
    setParts.push("content = ?");
    vals.push(content == null ? null : String(content));
  }
  if (tagN !== undefined) {
    setParts.push("tag = ?");
    vals.push(tagN);
  }
  if (dueAt !== undefined) {
    setParts.push("occur_at = ?");
    vals.push(dueAt);
  }
  setParts.push("updated_at = CURRENT_TIMESTAMP(3)");
  vals.push(userId, vbtId);

  await conn.query(
    `UPDATE vision_board_todos SET ${setParts.join(", ")}
     WHERE user_id = ? AND id = ? AND deleted_at IS NULL`,
    vals
  );
}

export async function softDeleteVisionBoardTodoFromUnified(conn, userId, unifiedTodoId, deletedAt) {
  const vbtId = parseVisionBoardTodoIdFromUnifiedId(unifiedTodoId);
  if (vbtId == null) return;
  const at = deletedAt || new Date();
  await conn.query(
    `
      UPDATE vision_board_todos
      SET deleted_at = ?, updated_at = ?
      WHERE user_id = ? AND id = ? AND deleted_at IS NULL
    `,
    [at, at, userId, vbtId]
  );
}
