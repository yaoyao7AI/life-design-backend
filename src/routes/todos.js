import { randomUUID } from "node:crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  normalizeTodoTag,
  nowDate,
  parseBool,
  parseCompletedFromTodo,
  parseCursor,
  parseLimit
} from "../utils/syncUtils.js";
import {
  ensureTodosVisionColumns,
  mirrorUnifiedTodoToVisionRow,
  parseVisionBoardTodoIdFromUnifiedId,
  softDeleteVisionBoardTodoFromUnified
} from "../utils/visionUnifiedTodoSync.js";

const router = Router();

/**
 * HTTP 链路追踪：与 body 内幂等字段 request_id（last_request_id）无关。
 * 优先透传客户端 X-Request-Id；缺失则服务端生成 UUID，并写回响应头。
 * 放在鉴权前，便于 401 等响应也可按 request_id 排障。
 */
function assignTodosHttpRequestId(req, res, next) {
  const raw = req.headers["x-request-id"] ?? req.headers["X-Request-Id"];
  const trimmed = typeof raw === "string" ? raw.trim().slice(0, 128) : "";
  const rid = trimmed || randomUUID();
  req.todosHttpRequestId = rid;
  res.setHeader("X-Request-Id", rid);
  next();
}

router.use(assignTodosHttpRequestId);
router.use(authenticateToken);

/** 与 GET 列表一致：无应用层缓存，仅直连连接池查库 */
function todoApiLogEnabled() {
  return ["1", "true", "yes", "on"].includes(
    String(process.env.TODO_API_LOG || "").trim().toLowerCase()
  );
}

function logTodoUpsertVerify(meta) {
  console.log(
    "[TODO_UPSERT_VERIFY]",
    JSON.stringify({
      ts: new Date().toISOString(),
      ...meta
    })
  );
}

function logTodoList(meta) {
  if (!todoApiLogEnabled()) return;
  console.log("[TODO_LIST]", JSON.stringify({ ts: new Date().toISOString(), ...meta }));
}

function logTodoDeleteTrace(meta) {
  console.log("[TODO_DELETE]", JSON.stringify({ ts: new Date().toISOString(), ...meta }));
}

function toIso(dt) {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return d.toISOString();
}

function parseExpectedRev(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function normalizeClientId(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizeRequestId(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function pickVisionIdForTodo(todo) {
  if (todo == null || typeof todo !== "object") return null;
  const raw =
    Object.prototype.hasOwnProperty.call(todo, "vision_id") || Object.prototype.hasOwnProperty.call(todo, "visionId")
      ? todo.vision_id ?? todo.visionId
      : undefined;
  if (raw === undefined) return null;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function pickSourceValForInsert(todo) {
  if (todo == null || typeof todo !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(todo, "source")) return null;
  const s = todo.source;
  if (s === undefined || s === null || s === "") return null;
  return String(s).trim().slice(0, 32);
}

function isBase64DataUrl(value) {
  if (typeof value !== "string") return false;
  return /^data:[^;]+;base64,/i.test(value.trim());
}

function containsBase64ImagePayload(input) {
  if (!input) return false;
  if (typeof input === "string") {
    return isBase64DataUrl(input) && /^data:image\//i.test(input.trim());
  }
  if (Array.isArray(input)) {
    return input.some((item) => containsBase64ImagePayload(item));
  }
  if (typeof input === "object") {
    for (const value of Object.values(input)) {
      if (containsBase64ImagePayload(value)) return true;
    }
  }
  return false;
}

function rowToTodoItem(row) {
  return {
    id: row.id,
    content: row.content,
    tag: row.tag ?? null,
    due_at: row.due_at ? new Date(row.due_at).toISOString() : null,
    completed: !!row.completed,
    completed_at: toIso(row.completed_at),
    rev: row.rev,
    updated_at: toIso(row.updated_at),
    deleted_at: toIso(row.deleted_at),
    source: row.source ?? null,
    vision_id: row.vision_id != null ? Number(row.vision_id) : null,
    vision_name:
      row.source === "vision" ? (row.vision_name != null ? String(row.vision_name) : null) : null,
    attachments: []
  };
}

async function attachAttachments(db, userId, todos, includeDeleted) {
  const todoIds = todos.map(t => t.id);
  if (todoIds.length === 0) return;

  const whereDeleted = includeDeleted ? "" : "AND deleted_at IS NULL";
  const [rows] = await db.query(
    `
      SELECT id, todo_id, type, url, file_name, created_at, updated_at, deleted_at
      FROM todo_attachments
      WHERE user_id = ?
        AND todo_id IN (?)
        ${whereDeleted}
      ORDER BY updated_at ASC, id ASC
    `,
    [userId, todoIds]
  );

  const byTodoId = new Map();
  for (const t of todos) byTodoId.set(t.id, t);

  for (const r of rows) {
    const todo = byTodoId.get(r.todo_id);
    if (!todo) continue;
    todo.attachments.push({
      id: r.id,
      type: r.type,
      url: r.url,
      file_name: r.file_name ?? null,
      updated_at: toIso(r.updated_at),
      deleted_at: toIso(r.deleted_at)
    });
  }
}

/** 写入后从数据库读取完整一条（与 GET items[] 单条结构一致，含 attachments） */
async function loadTodoItemForResponse(db, userId, id, includeDeletedAttachments) {
  const [rows] = await db.query(
    `
      SELECT t.user_id, t.id, t.content, t.tag, t.due_at, t.completed, t.completed_at,
             t.updated_at, t.deleted_at, t.client_id, t.rev, t.source, t.vision_id,
             CASE
               WHEN t.source = 'vision' THEN vb.name
               ELSE NULL
             END AS vision_name
      FROM todos t
      LEFT JOIN vision_boards vb
        ON vb.id = t.vision_id
       AND vb.user_id = t.user_id
      WHERE t.user_id = ? AND t.id = ?
      LIMIT 1
    `,
    [userId, id]
  );
  if (!rows.length) return null;
  const item = rowToTodoItem(rows[0]);
  await attachAttachments(db, userId, [item], includeDeletedAttachments);
  return item;
}

/**
 * 列表（支持增量）
 * GET /api/todos?since=<cursor>&limit=300&include_deleted=1
 */
router.get("/", async (req, res) => {
  try {
    await ensureTodosVisionColumns(pool);
    const userId = req.userId;
    const includeDeleted = parseBool(req.query.include_deleted, false);
    const limit = parseLimit(req.query.limit, 300, 500);
    const cursorInput = req.query.since || req.query.cursor || "0:0";
    const { updatedAt, id } = parseCursor(cursorInput);
    const visionIdRaw = req.query.vision_id ?? req.query.visionId;
    const visionId =
      visionIdRaw === undefined || visionIdRaw === null || visionIdRaw === ""
        ? null
        : Number(visionIdRaw);
    if (visionIdRaw !== undefined && (!Number.isFinite(visionId) || visionId <= 0)) {
      return res.status(400).json({ error: "vision_id 非法" });
    }

    const whereDeleted = includeDeleted ? "" : "AND t.deleted_at IS NULL";
    const visionScopedFullSync = visionId != null;
    const whereVisionScoped =
      visionScopedFullSync ? "AND t.source = 'vision' AND t.vision_id = ?" : "";
    const whereCursor = visionScopedFullSync
      ? ""
      : "AND (t.updated_at > ? OR (t.updated_at = ? AND t.id > ?))";
    const limitClause = visionScopedFullSync ? "" : "LIMIT ?";
    const params = visionScopedFullSync
      ? [userId, visionId]
      : [userId, updatedAt, updatedAt, id, limit];
    const [rows] = await pool.query(
      `
        SELECT t.user_id, t.id, t.content, t.tag, t.due_at, t.completed, t.completed_at,
               t.updated_at, t.deleted_at, t.client_id, t.rev, t.source, t.vision_id,
               CASE
                 WHEN t.source = 'vision' THEN vb.name
                 ELSE NULL
               END AS vision_name
        FROM todos t
        LEFT JOIN vision_boards vb
          ON vb.id = t.vision_id
         AND vb.user_id = t.user_id
        WHERE t.user_id = ?
          ${whereDeleted}
          ${whereCursor}
          ${whereVisionScoped}
        ORDER BY t.updated_at ASC, t.id ASC
        ${limitClause}
      `,
      params
    );

    const todos = rows.map(rowToTodoItem);
    await attachAttachments(pool, userId, todos, includeDeleted);

    const last = rows[rows.length - 1];
    const serverTime = new Date().toISOString();
    const nextSince = last ? toIso(last.updated_at) : serverTime;

    logTodoList({
      request_id: req.todosHttpRequestId,
      user_id: userId,
      op: "GET",
      count: todos.length,
      since: cursorInput,
      include_deleted: includeDeleted,
      vision_id: visionId,
      mode: visionScopedFullSync ? "vision_full_sync" : "incremental",
      db: process.env.DB_NAME || null
    });

    res.json({
      server_time: serverTime,
      next_since: nextSince,
      items: todos
    });
  } catch (err) {
    console.error("[获取 Todo 列表错误]", req.todosHttpRequestId, err);
    res.status(500).json({ error: "获取 Todo 列表失败" });
  }
});

/**
 * 创建（幂等 upsert）
 * POST /api/todos
 */
router.post("/", async (req, res) => {
  const userId = req.userId;
  const body = req.body || {};
  if (containsBase64ImagePayload(body)) {
    return res
      .status(400)
      .json({ error: "BASE64_NOT_ALLOWED", message: "检测到 base64 图片，请先上传后仅传 image_url" });
  }
  const clientId = normalizeClientId(body.client_id ?? body.clientId);
  const requestId = normalizeRequestId(body.request_id ?? body.requestId);
  const todo = body.todo && typeof body.todo === "object" ? body.todo : body;
  const expectedRev = parseExpectedRev(todo.expected_rev ?? todo.expectedRev);

  const id =
    (typeof todo.id === "string" && todo.id.trim()) ||
    `todo_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

  const content = typeof todo.content === "string" ? todo.content.trim() : "";
  if (!content) return res.status(400).json({ error: "content 不能为空" });
  if (content.length > 200) return res.status(400).json({ error: "content 超过 200 字" });

  const tag = normalizeTodoTag(todo.tag);
  const dueAt = todo.due_at ?? todo.dueAt ?? todo.due_time ?? todo.dueTime;
  const dueAtDt = dueAt ? new Date(dueAt) : null;
  const completed = parseCompletedFromTodo(todo);
  const completedAt = todo.completed_at ?? todo.completedAt;
  const completedAtDt = completedAt ? new Date(completedAt) : null;

  const now = nowDate();
  const createdAt = todo.created_at ?? todo.createdAt;
  const createdAtDt = createdAt ? new Date(createdAt) : now;

  let connection;

  try {
    await ensureTodosVisionColumns(pool);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT rev, updated_at, deleted_at, last_request_id
        FROM todos
        WHERE user_id = ? AND id = ?
        FOR UPDATE
      `,
      [userId, id]
    );
    const existing = existingRows[0];

    if (existing && requestId && existing.last_request_id === requestId) {
      const item = await loadTodoItemForResponse(connection, userId, id, false);
      await connection.commit();
      connection.release();
      connection = null;
      if (item) {
        logTodoUpsertVerify({
          request_id: req.todosHttpRequestId,
          user_id: userId,
          todo_id: id,
          op: "idempotent_skip",
          completed: item.completed,
          rev: item.rev,
          db_read_after_write: true
        });
        return res.json({ todo: item });
      }
      return res.json({
        todo: { id, rev: existing.rev, updated_at: toIso(existing.updated_at) }
      });
    }

    if (existing && expectedRev !== null && expectedRev !== existing.rev) {
      throw Object.assign(new Error("rev 冲突，请先 pull 再重试"), {
        status: 409,
        server_rev: existing.rev
      });
    }
    if (!existing && expectedRev !== null) {
      throw Object.assign(new Error("rev 冲突，请先 pull 再重试"), {
        status: 409,
        server_rev: null
      });
    }

    const sourceVal = pickSourceValForInsert(todo);
    const visionIdVal = pickVisionIdForTodo(todo);

    if (!existing) {
      await connection.query(
        `
          INSERT INTO todos
            (user_id, id, content, tag, due_at, completed, completed_at,
             created_at, updated_at, deleted_at, client_id, last_request_id, rev, source, vision_id)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, ?)
        `,
        [
          userId,
          id,
          content,
          tag,
          dueAtDt,
          completed,
          completedAtDt,
          createdAtDt,
          now,
          clientId,
          requestId,
          sourceVal,
          visionIdVal
        ]
      );
      const vbtId = parseVisionBoardTodoIdFromUnifiedId(id);
      if (vbtId != null) {
        await mirrorUnifiedTodoToVisionRow(connection, userId, id, {
          content,
          tag,
          dueAt: dueAtDt
        });
      }
      const item = await loadTodoItemForResponse(connection, userId, id, false);
      await connection.commit();
      connection.release();
      connection = null;
      logTodoUpsertVerify({
        request_id: req.todosHttpRequestId,
        user_id: userId,
        todo_id: id,
        op: "insert",
        completed: item?.completed ?? completed,
        rev: item?.rev ?? 1,
        db_read_after_write: !!item
      });
      return res.json({ todo: item ?? { id, rev: 1, updated_at: toIso(now), completed, attachments: [] } });
    }

    const setParts = [
      "content = ?",
      "tag = ?",
      "due_at = ?",
      "completed = ?",
      "completed_at = ?",
      "deleted_at = NULL",
      "client_id = ?",
      "last_request_id = ?",
      "updated_at = ?"
    ];
    const updVals = [
      content,
      tag,
      dueAtDt,
      completed,
      completedAtDt,
      clientId,
      requestId,
      now
    ];
    if (Object.prototype.hasOwnProperty.call(todo, "source")) {
      const s = todo.source;
      setParts.push("source = ?");
      updVals.push(s == null || s === "" ? null : String(s).trim().slice(0, 32));
    }
    if (
      Object.prototype.hasOwnProperty.call(todo, "vision_id") ||
      Object.prototype.hasOwnProperty.call(todo, "visionId")
    ) {
      setParts.push("vision_id = ?");
      updVals.push(pickVisionIdForTodo(todo));
    }
    setParts.push("rev = rev + 1");
    updVals.push(userId, id);

    await connection.query(
      `UPDATE todos SET ${setParts.join(", ")} WHERE user_id = ? AND id = ?`,
      updVals
    );

    if (parseVisionBoardTodoIdFromUnifiedId(id) != null) {
      await mirrorUnifiedTodoToVisionRow(connection, userId, id, {
        content,
        tag,
        dueAt: dueAtDt
      });
    }

    const item = await loadTodoItemForResponse(connection, userId, id, false);
    await connection.commit();
    connection.release();
    connection = null;

    logTodoUpsertVerify({
      request_id: req.todosHttpRequestId,
      user_id: userId,
      todo_id: id,
      op: "update",
      completed: item?.completed ?? completed,
      rev: item?.rev ?? existing.rev + 1,
      db_read_after_write: !!item
    });

    res.json({
      todo:
        item ??
        ({
          id,
          rev: existing.rev + 1,
          updated_at: toIso(now),
          content,
          tag,
          due_at: dueAtDt ? dueAtDt.toISOString() : null,
          completed,
          completed_at: toIso(completedAtDt),
          deleted_at: null,
          attachments: []
        })
    });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[创建/更新 Todo 错误]", req.todosHttpRequestId, err);
    if (err?.status === 409) {
      return res.status(409).json({ error: "CONFLICT", message: err.message, server_rev: err.server_rev ?? null });
    }
    res.status(500).json({ error: "创建/更新 Todo 失败" });
  }
});

/**
 * 删除（软删除）
 * DELETE /api/todos/:id
 */
router.delete("/:id", async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const body = req.body || {};
  const clientId = normalizeClientId(body.client_id ?? body.clientId);
  const requestId = normalizeRequestId(body.request_id ?? body.requestId);
  const expectedRev = parseExpectedRev(body.expected_rev ?? body.expectedRev);
  let connection;

  try {
    const now = nowDate();
    await ensureTodosVisionColumns(pool);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `
        SELECT rev, deleted_at, last_request_id
        FROM todos
        WHERE user_id = ? AND id = ?
        FOR UPDATE
      `,
      [userId, id]
    );
    const existing = existingRows[0];

    if (!existing) {
      await connection.commit();
      connection.release();
      logTodoDeleteTrace({
        request_id: req.todosHttpRequestId,
        user_id: userId,
        todo_id: id,
        op: "not_found"
      });
      return res.status(204).send();
    }

    if (requestId && existing.last_request_id === requestId) {
      await connection.commit();
      connection.release();
      logTodoDeleteTrace({
        request_id: req.todosHttpRequestId,
        user_id: userId,
        todo_id: id,
        op: "idempotent_skip"
      });
      return res.status(204).send();
    }

    if (expectedRev !== null && expectedRev !== existing.rev) {
      throw Object.assign(new Error("rev 冲突，请先 pull 再重试"), {
        status: 409,
        server_rev: existing.rev
      });
    }

    let deleteOp = "touch_already_deleted";
    if (!existing.deleted_at) {
      deleteOp = "soft_delete";
      await connection.query(
        `
          UPDATE todos
          SET deleted_at = ?,
              updated_at = ?,
              client_id = ?,
              last_request_id = ?,
              rev = rev + 1
          WHERE user_id = ? AND id = ?
        `,
        [now, now, clientId, requestId, userId, id]
      );
      if (parseVisionBoardTodoIdFromUnifiedId(id) != null) {
        await softDeleteVisionBoardTodoFromUnified(connection, userId, id, now);
      }
    } else {
      await connection.query(
        `
          UPDATE todos
          SET updated_at = ?,
              client_id = ?,
              last_request_id = ?
          WHERE user_id = ? AND id = ?
        `,
        [now, clientId, requestId, userId, id]
      );
    }

    await connection.commit();
    connection.release();
    logTodoDeleteTrace({
      request_id: req.todosHttpRequestId,
      user_id: userId,
      todo_id: id,
      op: deleteOp
    });
    res.status(204).send();
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[删除 Todo 错误]", req.todosHttpRequestId, err);
    if (err?.status === 409) {
      return res.status(409).json({ error: "CONFLICT", message: err.message, server_rev: err.server_rev ?? null });
    }
    res.status(500).json({ error: "删除 Todo 失败" });
  }
});

export default router;

