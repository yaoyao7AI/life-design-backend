import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  normalizeTodoTag,
  nowDate,
  parseBool,
  parseCursor,
  parseLimit
} from "../utils/syncUtils.js";

const router = Router();
router.use(authenticateToken);

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
    attachments: []
  };
}

async function attachAttachments(userId, todos, includeDeleted) {
  const todoIds = todos.map(t => t.id);
  if (todoIds.length === 0) return;

  const whereDeleted = includeDeleted ? "" : "AND deleted_at IS NULL";
  const [rows] = await pool.query(
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

/**
 * 列表（支持增量）
 * GET /api/todos?since=<cursor>&limit=300&include_deleted=1
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const includeDeleted = parseBool(req.query.include_deleted, false);
    const limit = parseLimit(req.query.limit, 300, 500);
    const cursorInput = req.query.since || req.query.cursor || "0:0";
    const { updatedAt, id } = parseCursor(cursorInput);

    const whereDeleted = includeDeleted ? "" : "AND deleted_at IS NULL";
    const [rows] = await pool.query(
      `
        SELECT user_id, id, content, tag, due_at, completed, completed_at,
               updated_at, deleted_at, client_id, rev
        FROM todos
        WHERE user_id = ?
          ${whereDeleted}
          AND (updated_at > ? OR (updated_at = ? AND id > ?))
        ORDER BY updated_at ASC, id ASC
        LIMIT ?
      `,
      [userId, updatedAt, updatedAt, id, limit]
    );

    const todos = rows.map(rowToTodoItem);
    await attachAttachments(userId, todos, includeDeleted);

    const last = rows[rows.length - 1];
    const serverTime = new Date().toISOString();
    const nextSince = last ? toIso(last.updated_at) : serverTime;

    res.json({
      server_time: serverTime,
      next_since: nextSince,
      items: todos
    });
  } catch (err) {
    console.error("[获取 Todo 列表错误]", err);
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
  const clientId = normalizeClientId(body.client_id ?? body.clientId);
  const requestId = normalizeRequestId(body.request_id ?? body.requestId);
  const todo = body.todo && typeof body.todo === "object" ? body.todo : body;
  const expectedRev = parseExpectedRev(todo.expected_rev ?? todo.expectedRev);
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const id =
      (typeof todo.id === "string" && todo.id.trim()) ||
      `todo_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;

    const content = typeof todo.content === "string" ? todo.content.trim() : "";
    if (!content) return res.status(400).json({ error: "content 不能为空" });
    if (content.length > 200) return res.status(400).json({ error: "content 超过 200 字" });

    const tag = normalizeTodoTag(todo.tag);
    const dueAt = todo.due_at ?? todo.dueAt;
    const dueAtDt = dueAt ? new Date(dueAt) : null;
    const completed = !!todo.completed;
    const completedAt = todo.completed_at ?? todo.completedAt;
    const completedAtDt = completedAt ? new Date(completedAt) : null;

    const now = nowDate();
    const createdAt = todo.created_at ?? todo.createdAt;
    const createdAtDt = createdAt ? new Date(createdAt) : now;

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
      await connection.commit();
      connection.release();
      return res.json({ todo: { id, rev: existing.rev, updated_at: toIso(existing.updated_at) } });
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

    if (!existing) {
      await connection.query(
        `
          INSERT INTO todos
            (user_id, id, content, tag, due_at, completed, completed_at,
             created_at, updated_at, deleted_at, client_id, last_request_id, rev)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1)
        `,
        [userId, id, content, tag, dueAtDt, completed, completedAtDt, createdAtDt, now, clientId, requestId]
      );
      await connection.commit();
      connection.release();
      return res.json({ todo: { id, rev: 1, updated_at: toIso(now) } });
    }

    await connection.query(
      `
        UPDATE todos
        SET content = ?,
            tag = ?,
            due_at = ?,
            completed = ?,
            completed_at = ?,
            deleted_at = NULL,
            client_id = ?,
            last_request_id = ?,
            updated_at = ?,
            rev = rev + 1
        WHERE user_id = ? AND id = ?
      `,
      [content, tag, dueAtDt, completed, completedAtDt, clientId, requestId, now, userId, id]
    );

    const [afterRows] = await connection.query(
      `SELECT rev, updated_at FROM todos WHERE user_id = ? AND id = ? LIMIT 1`,
      [userId, id]
    );
    const after = afterRows[0];
    await connection.commit();
    connection.release();

    res.json({ todo: { id, rev: after?.rev ?? (existing.rev + 1), updated_at: toIso(after?.updated_at ?? now) } });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[创建/更新 Todo 错误]", err);
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
      return res.status(204).send();
    }

    if (requestId && existing.last_request_id === requestId) {
      await connection.commit();
      connection.release();
      return res.status(204).send();
    }

    if (expectedRev !== null && expectedRev !== existing.rev) {
      throw Object.assign(new Error("rev 冲突，请先 pull 再重试"), {
        status: 409,
        server_rev: existing.rev
      });
    }

    if (!existing.deleted_at) {
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
    res.status(204).send();
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[删除 Todo 错误]", err);
    if (err?.status === 409) {
      return res.status(409).json({ error: "CONFLICT", message: err.message, server_rev: err.server_rev ?? null });
    }
    res.status(500).json({ error: "删除 Todo 失败" });
  }
});

export default router;

