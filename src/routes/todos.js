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
import { normalizeTodoAttachmentsInput } from "../utils/todoAttachmentUtils.js";
import { analyzeTodoWithDeepSeek, deepseekEnabled } from "../utils/deepseekLifeDesign.js";

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

function parseNullableInt(input, { min = null, max = null } = {}) {
  if (input === undefined || input === null || input === "") return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  const value = Math.floor(n);
  if (min != null && value < min) return null;
  if (max != null && value > max) return null;
  return value;
}

function parseNullableBool(input) {
  if (input === undefined || input === null || input === "") return null;
  return parseBool(input, false);
}

function normalizeShortText(input, max = 64) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function normalizeReflectionText(input) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim();
  return s ? s.slice(0, 4000) : null;
}

function parseAiTagsInput(input) {
  if (input === undefined || input === null || input === "") return null;
  if (typeof input === "object") return input;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
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

function pickVisionBoardIdForTodo(todo) {
  if (todo == null || typeof todo !== "object") return null;
  const hasField =
    Object.prototype.hasOwnProperty.call(todo, "vision_board_id") ||
    Object.prototype.hasOwnProperty.call(todo, "visionBoardId");
  if (!hasField) return undefined;
  const raw = todo.vision_board_id ?? todo.visionBoardId;
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const s = String(raw).trim();
  return s ? s.slice(0, 64) : null;
}

function normalizeEnergyFeedback(input) {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  const v = String(input).trim().toLowerCase();
  if (!v) return null;
  if (!["positive", "neutral", "negative"].includes(v)) return "__invalid__";
  return v;
}

function normalizeMeaningFeedback(input) {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  const v = String(input).trim().toLowerCase();
  if (!v) return null;
  if (!["high", "medium", "low"].includes(v)) return "__invalid__";
  return v;
}

/** 待办优先级 P0–P5；undefined=未传，null=清空，__invalid__=非法 */
function normalizeTodoPriority(input) {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  const n = Number(input);
  if (!Number.isInteger(n) || n < 0 || n > 5) return "__invalid__";
  return n;
}

function pickTodoPriority(todo) {
  if (todo == null || typeof todo !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(todo, "priority")) {
    return normalizeTodoPriority(todo.priority);
  }
  const nested = todo.payload;
  if (nested && typeof nested === "object" && Object.prototype.hasOwnProperty.call(nested, "priority")) {
    return normalizeTodoPriority(nested.priority);
  }
  return undefined;
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

async function replaceTodoAttachments(db, userId, todoId, attachments, now) {
  const [existingRows] = await db.query(
    `
      SELECT id
      FROM todo_attachments
      WHERE user_id = ? AND todo_id = ?
      FOR UPDATE
    `,
    [userId, todoId]
  );

  const existingIds = new Set(existingRows.map((row) => String(row.id)));
  const keepIds = new Set();

  for (const attachment of attachments) {
    const attachmentId =
      attachment.id && existingIds.has(String(attachment.id))
        ? String(attachment.id)
        : `att_${randomUUID()}`;
    keepIds.add(attachmentId);

    if (existingIds.has(attachmentId)) {
      await db.query(
        `
          UPDATE todo_attachments
          SET type = ?,
              url = ?,
              file_name = ?,
              updated_at = ?,
              deleted_at = NULL,
              rev = rev + 1
          WHERE user_id = ? AND id = ?
        `,
        [attachment.type, attachment.url, attachment.file_name, now, userId, attachmentId]
      );
      continue;
    }

    await db.query(
      `
        INSERT INTO todo_attachments
          (user_id, id, todo_id, type, url, file_name, created_at, updated_at, deleted_at, client_id, rev)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1)
      `,
      [userId, attachmentId, todoId, attachment.type, attachment.url, attachment.file_name, now, now]
    );
  }

  for (const row of existingRows) {
    const existingId = String(row.id);
    if (keepIds.has(existingId)) continue;
    await db.query(
      `
        UPDATE todo_attachments
        SET deleted_at = ?,
            updated_at = ?,
            rev = rev + 1
        WHERE user_id = ? AND id = ?
      `,
      [now, now, userId, existingId]
    );
  }
}

async function validateVisionBoardOwnership(db, userId, visionBoardId) {
  if (visionBoardId == null) return true;
  const [rows] = await db.query(
    "SELECT 1 FROM vision_boards WHERE id = ? AND user_id = ? LIMIT 1",
    [visionBoardId, userId]
  );
  return rows.length > 0;
}

function rowToTodoItem(row) {
  const priority =
    row.priority === undefined || row.priority === null || row.priority === ""
      ? null
      : Number(row.priority);
  return {
    id: row.id,
    content: row.content,
    tag: row.tag ?? null,
    priority: Number.isInteger(priority) && priority >= 0 && priority <= 5 ? priority : null,
    due_at: row.due_at ? new Date(row.due_at).toISOString() : null,
    completed: !!row.completed,
    completed_at: toIso(row.completed_at),
    rev: row.rev,
    updated_at: toIso(row.updated_at),
    deleted_at: toIso(row.deleted_at),
    source: row.source ?? null,
    vision_id: row.vision_id != null ? Number(row.vision_id) : null,
    emotion_before: row.emotion_before ?? null,
    emotion_after: row.emotion_after ?? null,
    energy_before: row.energy_before != null ? Number(row.energy_before) : null,
    energy_after: row.energy_after != null ? Number(row.energy_after) : null,
    is_active_choice: row.is_active_choice == null ? null : !!row.is_active_choice,
    engagement_level: row.engagement_level != null ? Number(row.engagement_level) : null,
    completion_feeling: row.completion_feeling ?? null,
    life_dimension: row.life_dimension ?? null,
    behavior_type: row.behavior_type ?? null,
    ai_tags:
      row.ai_tags && typeof row.ai_tags === "string"
        ? (() => {
            try {
              return JSON.parse(row.ai_tags);
            } catch {
              return null;
            }
          })()
        : row.ai_tags ?? null,
    reflection_note: row.reflection_note ?? null,
    vision_board_id: row.vision_board_id ?? null,
    energy_feedback: row.energy_feedback ?? null,
    meaning_feedback: row.meaning_feedback ?? null,
    vision_name: row.vision_name != null ? String(row.vision_name) : null,
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
      fileName: r.file_name ?? null,
      updated_at: toIso(r.updated_at),
      deleted_at: toIso(r.deleted_at)
    });
  }
}

/** 写入后从数据库读取完整一条（与 GET items[] 单条结构一致，含 attachments） */
async function loadTodoItemForResponse(db, userId, id, includeDeletedAttachments) {
  const [rows] = await db.query(
    `
      SELECT t.user_id, t.id, t.content, t.tag, t.priority, t.due_at, t.completed, t.completed_at,
             t.updated_at, t.deleted_at, t.client_id, t.rev, t.source, t.vision_id,
             t.emotion_before, t.emotion_after, t.energy_before, t.energy_after,
             t.is_active_choice, t.engagement_level, t.completion_feeling, t.life_dimension,
             t.behavior_type, t.ai_tags, t.reflection_note, t.vision_board_id,
             t.energy_feedback, t.meaning_feedback,
             CASE
               WHEN t.source = 'vision' OR t.vision_board_id IS NOT NULL THEN vb.name
               ELSE NULL
             END AS vision_name
      FROM todos t
      LEFT JOIN vision_boards vb
        ON vb.user_id = t.user_id
       AND (
         (t.vision_id IS NOT NULL AND vb.id = t.vision_id)
         OR (
           t.vision_board_id IS NOT NULL
           AND t.vision_board_id REGEXP '^[0-9]+$'
           AND vb.id = CAST(t.vision_board_id AS UNSIGNED)
         )
       )
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
        SELECT t.user_id, t.id, t.content, t.tag, t.priority, t.due_at, t.completed, t.completed_at,
               t.updated_at, t.deleted_at, t.client_id, t.rev, t.source, t.vision_id,
               t.emotion_before, t.emotion_after, t.energy_before, t.energy_after,
               t.is_active_choice, t.engagement_level, t.completion_feeling, t.life_dimension,
               t.behavior_type, t.ai_tags, t.reflection_note, t.vision_board_id,
               t.energy_feedback, t.meaning_feedback,
               CASE
                 WHEN t.source = 'vision' OR t.vision_board_id IS NOT NULL THEN vb.name
                 ELSE NULL
               END AS vision_name
        FROM todos t
        LEFT JOIN vision_boards vb
          ON vb.user_id = t.user_id
         AND (
           (t.vision_id IS NOT NULL AND vb.id = t.vision_id)
           OR (
             t.vision_board_id IS NOT NULL
             AND t.vision_board_id REGEXP '^[0-9]+$'
             AND vb.id = CAST(t.vision_board_id AS UNSIGNED)
           )
         )
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
  const priority = pickTodoPriority(todo);
  const dueAt = todo.due_at ?? todo.dueAt ?? todo.due_time ?? todo.dueTime;
  const dueAtDt = dueAt ? new Date(dueAt) : null;
  const completed = parseCompletedFromTodo(todo);
  const completedAt = todo.completed_at ?? todo.completedAt;
  const completedAtDt = completedAt ? new Date(completedAt) : null;
  const emotionBefore = normalizeShortText(todo.emotion_before ?? todo.emotionBefore, 32);
  const emotionAfter = normalizeShortText(todo.emotion_after ?? todo.emotionAfter, 32);
  const energyBefore = parseNullableInt(todo.energy_before ?? todo.energyBefore, { min: 0, max: 10 });
  const energyAfter = parseNullableInt(todo.energy_after ?? todo.energyAfter, { min: 0, max: 10 });
  const isActiveChoice = parseNullableBool(todo.is_active_choice ?? todo.isActiveChoice);
  const engagementLevel = parseNullableInt(todo.engagement_level ?? todo.engagementLevel, {
    min: 1,
    max: 5
  });
  const completionFeeling = normalizeShortText(
    todo.completion_feeling ?? todo.completionFeeling,
    64
  );
  let lifeDimension = normalizeShortText(todo.life_dimension ?? todo.lifeDimension, 20);
  let behaviorType = normalizeShortText(todo.behavior_type ?? todo.behaviorType, 20);
  let aiTags = parseAiTagsInput(todo.ai_tags ?? todo.aiTags);
  const reflectionNote = normalizeReflectionText(todo.reflection_note ?? todo.reflectionNote);
  const visionBoardId = pickVisionBoardIdForTodo(todo);
  const energyFeedback = normalizeEnergyFeedback(todo.energy_feedback ?? todo.energyFeedback);
  const meaningFeedback = normalizeMeaningFeedback(todo.meaning_feedback ?? todo.meaningFeedback);

  const now = nowDate();
  const createdAt = todo.created_at ?? todo.createdAt;
  const createdAtDt = createdAt ? new Date(createdAt) : now;

  if (engagementLevel === null && (todo.engagement_level !== undefined || todo.engagementLevel !== undefined)) {
    return res.status(400).json({ error: "engagement_level 必须是 1-5 的整数" });
  }
  if (energyBefore === null && (todo.energy_before !== undefined || todo.energyBefore !== undefined)) {
    return res.status(400).json({ error: "energy_before 必须是 0-10 的整数" });
  }
  if (energyAfter === null && (todo.energy_after !== undefined || todo.energyAfter !== undefined)) {
    return res.status(400).json({ error: "energy_after 必须是 0-10 的整数" });
  }
  if (energyFeedback === "__invalid__") {
    return res.status(400).json({ error: "energy_feedback 必须为 positive/neutral/negative" });
  }
  if (meaningFeedback === "__invalid__") {
    return res.status(400).json({ error: "meaning_feedback 必须为 high/medium/low" });
  }
  if (priority === "__invalid__") {
    return res.status(400).json({ error: "priority 必须是 0-5 的整数" });
  }

  if (!aiTags && deepseekEnabled() && process.env.ENABLE_TODO_AI_TAGGING !== "0") {
    try {
      aiTags = await analyzeTodoWithDeepSeek({
        title: content,
        duration: todo.duration ?? todo.duration_minutes ?? todo.durationMinutes ?? null,
        emotion_after: emotionAfter,
        engagement_level: engagementLevel,
        reflection_note: reflectionNote,
        life_dimension: lifeDimension,
        behavior_type: behaviorType
      });
      if (aiTags?.life_dimension && !lifeDimension) lifeDimension = aiTags.life_dimension;
      if (aiTags?.behavior_type && !behaviorType) behaviorType = aiTags.behavior_type;
    } catch (aiErr) {
      console.warn("[TODO_AI_TAGGING] 分析失败，已跳过:", aiErr?.message || aiErr);
    }
  }

  let connection;

  try {
    const attachmentsInput = normalizeTodoAttachmentsInput(todo.attachments);
    await ensureTodosVisionColumns(pool);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    if (visionBoardId !== undefined) {
      const ok = await validateVisionBoardOwnership(connection, userId, visionBoardId);
      if (!ok) {
        throw Object.assign(new Error("vision_board_id 不存在或不属于当前用户"), { status: 400 });
      }
    }

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
            (user_id, id, content, tag, priority, due_at, completed, completed_at,
             created_at, updated_at, deleted_at, client_id, last_request_id, rev, source, vision_id,
             emotion_before, emotion_after, energy_before, energy_after, is_active_choice,
             engagement_level, completion_feeling, life_dimension, behavior_type, ai_tags, reflection_note,
             vision_board_id, energy_feedback, meaning_feedback)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          id,
          content,
          tag,
          priority === undefined ? null : priority,
          dueAtDt,
          completed,
          completedAtDt,
          createdAtDt,
          now,
          clientId,
          requestId,
          sourceVal,
          visionIdVal,
          emotionBefore,
          emotionAfter,
          energyBefore,
          energyAfter,
          isActiveChoice,
          engagementLevel,
          completionFeeling,
          lifeDimension,
          behaviorType,
          aiTags ? JSON.stringify(aiTags) : null,
          reflectionNote,
          visionBoardId === undefined ? null : visionBoardId,
          energyFeedback === undefined ? null : energyFeedback,
          meaningFeedback === undefined ? null : meaningFeedback
        ]
      );
      if (attachmentsInput.provided) {
        await replaceTodoAttachments(connection, userId, id, attachmentsInput.items, now);
      }
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
      "emotion_before = ?",
      "emotion_after = ?",
      "energy_before = ?",
      "energy_after = ?",
      "is_active_choice = ?",
      "engagement_level = ?",
      "completion_feeling = ?",
      "life_dimension = ?",
      "behavior_type = ?",
      "ai_tags = ?",
      "reflection_note = ?",
      "energy_feedback = ?",
      "meaning_feedback = ?",
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
      emotionBefore,
      emotionAfter,
      energyBefore,
      energyAfter,
      isActiveChoice,
      engagementLevel,
      completionFeeling,
      lifeDimension,
      behaviorType,
      aiTags ? JSON.stringify(aiTags) : null,
      reflectionNote,
      energyFeedback === undefined ? null : energyFeedback,
      meaningFeedback === undefined ? null : meaningFeedback,
      clientId,
      requestId,
      now
    ];
    if (priority !== undefined) {
      setParts.push("priority = ?");
      updVals.push(priority);
    }
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
    if (
      Object.prototype.hasOwnProperty.call(todo, "vision_board_id") ||
      Object.prototype.hasOwnProperty.call(todo, "visionBoardId")
    ) {
      setParts.push("vision_board_id = ?");
      updVals.push(visionBoardId);
    }
    setParts.push("rev = rev + 1");
    updVals.push(userId, id);

    await connection.query(
      `UPDATE todos SET ${setParts.join(", ")} WHERE user_id = ? AND id = ?`,
      updVals
    );
    if (attachmentsInput.provided) {
      await replaceTodoAttachments(connection, userId, id, attachmentsInput.items, now);
    }

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
    if (err?.status && err?.status >= 400 && err?.status < 500) {
      return res.status(err.status).json({ error: "VALIDATION_ERROR", message: err.message });
    }
    res.status(500).json({ error: "创建/更新 Todo 失败" });
  }
});

/**
 * AI 分析待办行为标签（DeepSeek）
 * POST /api/todos/ai/analyze
 */
router.post("/ai/analyze", async (req, res) => {
  try {
    if (!deepseekEnabled()) {
      return res.status(400).json({ error: "DEEPSEEK_NOT_CONFIGURED" });
    }

    const todo = req.body?.todo && typeof req.body.todo === "object" ? req.body.todo : req.body || {};
    const title = String(todo.title ?? todo.content ?? "").trim();
    if (!title) {
      return res.status(400).json({ error: "title/content 不能为空" });
    }

    const payload = {
      title: title.slice(0, 200),
      duration: todo.duration ?? todo.duration_minutes ?? todo.durationMinutes ?? null,
      emotion_after: normalizeShortText(todo.emotion_after ?? todo.emotionAfter, 32),
      engagement_level: parseNullableInt(todo.engagement_level ?? todo.engagementLevel, {
        min: 1,
        max: 5
      }),
      reflection_note: normalizeReflectionText(todo.reflection_note ?? todo.reflectionNote),
      life_dimension: normalizeShortText(todo.life_dimension ?? todo.lifeDimension, 20),
      behavior_type: normalizeShortText(todo.behavior_type ?? todo.behaviorType, 20)
    };

    const aiTags = await analyzeTodoWithDeepSeek(payload);
    if (!aiTags) {
      return res.status(502).json({ error: "AI_ANALYSIS_EMPTY" });
    }

    return res.json({
      success: true,
      data: {
        life_dimension: aiTags.life_dimension ?? null,
        behavior_type: aiTags.behavior_type ?? null,
        ai_tags: aiTags
      }
    });
  } catch (err) {
    console.error("[TODO_AI_ANALYZE] 错误", err);
    return res.status(500).json({ error: "AI 分析失败" });
  }
});

/**
 * 完成待办（支持轻量反馈）
 * PATCH /api/todos/:id/complete
 */
router.patch("/:id/complete", async (req, res) => {
  const userId = req.userId;
  const { id } = req.params;
  const body = req.body || {};
  const completedRaw = body.completed;
  const completed = completedRaw === undefined ? true : parseBool(completedRaw, true);
  const energyFeedback = normalizeEnergyFeedback(body.energy_feedback ?? body.energyFeedback);
  const meaningFeedback = normalizeMeaningFeedback(body.meaning_feedback ?? body.meaningFeedback);
  const reflectionNote = normalizeReflectionText(body.reflection_note ?? body.reflectionNote);

  if (energyFeedback === "__invalid__") {
    return res.status(400).json({ error: "energy_feedback 必须为 positive/neutral/negative" });
  }
  if (meaningFeedback === "__invalid__") {
    return res.status(400).json({ error: "meaning_feedback 必须为 high/medium/low" });
  }

  let connection;
  try {
    const now = nowDate();
    await ensureTodosVisionColumns(pool);
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT id
        FROM todos
        WHERE user_id = ? AND id = ? AND deleted_at IS NULL
        LIMIT 1
        FOR UPDATE
      `,
      [userId, id]
    );
    if (!rows.length) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ error: "待办不存在" });
    }

    const setParts = ["completed = ?", "completed_at = ?", "updated_at = ?", "rev = rev + 1"];
    const values = [completed ? 1 : 0, completed ? now : null, now];

    if (energyFeedback !== undefined) {
      setParts.push("energy_feedback = ?");
      values.push(energyFeedback);
    }
    if (meaningFeedback !== undefined) {
      setParts.push("meaning_feedback = ?");
      values.push(meaningFeedback);
    }
    if (body.reflection_note !== undefined || body.reflectionNote !== undefined) {
      setParts.push("reflection_note = ?");
      values.push(reflectionNote);
    }

    values.push(userId, id);
    await connection.query(
      `UPDATE todos SET ${setParts.join(", ")} WHERE user_id = ? AND id = ?`,
      values
    );

    const item = await loadTodoItemForResponse(connection, userId, id, false);
    await connection.commit();
    connection.release();
    connection = null;
    return res.json({ todo: item });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    console.error("[完成 Todo 错误]", req.todosHttpRequestId, err);
    return res.status(500).json({ error: "完成 Todo 失败" });
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

