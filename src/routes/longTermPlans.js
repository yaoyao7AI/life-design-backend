import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { nowDate, parseBool, parseCursor, parseLimit } from "../utils/syncUtils.js";

const router = Router();
router.use(authenticateToken);

function toIso(dt) {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return d.toISOString();
}

function toDateOnly(dt) {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  const ms = d.getTime();
  if (!Number.isFinite(ms)) return null;
  return d.toISOString().slice(0, 10);
}

function parseJsonMaybe(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function normalizePayload(p) {
  if (p === undefined || p === null) return null;
  if (typeof p === "string") return p;
  try {
    return JSON.stringify(p);
  } catch {
    return null;
  }
}

function rowToPlanItem(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    start_date: toDateOnly(row.start_date),
    end_date: toDateOnly(row.end_date),
    payload: parseJsonMaybe(row.payload),
    rev: row.rev,
    updated_at: toIso(row.updated_at),
    deleted_at: toIso(row.deleted_at)
  };
}

function normalizeType(type) {
  const t = String(type || "").trim();
  if (t === "daily" || t === "weekly" || t === "monthly") return t;
  return "weekly";
}

function normalizeDateString(d) {
  if (!d) return null;
  // 允许传 Date / ISO / YYYY-MM-DD
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  // 只做最小校验
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
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

function parseExpectedRev(v) {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

/**
 * 列表（支持增量）
 * GET /api/plans/long-term?since=<cursor>&limit=200&include_deleted=1
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const includeDeleted = parseBool(req.query.include_deleted, false);
    const limit = parseLimit(req.query.limit, 200, 500);
    const cursorInput = req.query.since || req.query.cursor || "0:0";
    const { updatedAt, id } = parseCursor(cursorInput);

    const whereDeleted = includeDeleted ? "" : "AND deleted_at IS NULL";
    const [rows] = await pool.query(
      `
        SELECT user_id, id, type, title, start_date, end_date, payload,
               updated_at, deleted_at, client_id, rev
        FROM long_term_plans
        WHERE user_id = ?
          ${whereDeleted}
          AND (updated_at > ? OR (updated_at = ? AND id > ?))
        ORDER BY updated_at ASC, id ASC
        LIMIT ?
      `,
      [userId, updatedAt, updatedAt, id, limit]
    );

    const last = rows[rows.length - 1];
    const serverTime = new Date().toISOString();
    const nextSince = last ? toIso(last.updated_at) : serverTime;

    res.json({
      server_time: serverTime,
      next_since: nextSince,
      items: rows.map(rowToPlanItem)
    });
  } catch (err) {
    console.error("[获取长期主义计划列表错误]", err);
    res.status(500).json({ error: "获取长期主义计划列表失败" });
  }
});

async function upsertPlan(connection, userId, body, idFromParam) {
  const now = nowDate();

  const planIdRaw =
    (typeof idFromParam === "string" && idFromParam.trim()) ||
    (typeof body.id === "string" && body.id.trim()) ||
    `plan_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const planId = String(planIdRaw);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw Object.assign(new Error("title 不能为空"), { status: 400 });

  const startDate = normalizeDateString(body.start_date ?? body.startDate);
  const endDate = normalizeDateString(body.end_date ?? body.endDate);
  if (!startDate || !endDate) throw Object.assign(new Error("startDate/endDate 格式不正确"), { status: 400 });

  const type = normalizeType(body.type);
  const clientId = normalizeClientId(body.client_id ?? body.clientId);
  const requestId = normalizeRequestId(body.request_id ?? body.requestId);
  const expectedRev = parseExpectedRev(body.expected_rev ?? body.expectedRev);
  const payload = normalizePayload(body.payload);

  // 并发控制 + 幂等：锁定行
  const [existingRows] = await connection.query(
    `
      SELECT id, rev, updated_at, deleted_at, last_request_id
      FROM long_term_plans
      WHERE user_id = ? AND id = ?
      FOR UPDATE
    `,
    [userId, planId]
  );
  const existing = existingRows[0];

  if (existing && requestId && existing.last_request_id === requestId) {
    return { id: planId, rev: existing.rev, updated_at: existing.updated_at };
  }

  if (existing && expectedRev !== null && expectedRev !== existing.rev) {
    throw Object.assign(new Error("rev 冲突，请先 pull 再重试"), {
      status: 409,
      code: "CONFLICT",
      server_rev: existing.rev
    });
  }
  if (!existing && expectedRev !== null) {
    throw Object.assign(new Error("rev 冲突，请先 pull 再重试"), {
      status: 409,
      code: "CONFLICT",
      server_rev: null
    });
  }

  if (!existing) {
    await connection.query(
      `
        INSERT INTO long_term_plans
          (user_id, id, type, title, start_date, end_date, payload,
           created_at, updated_at, deleted_at, client_id, last_request_id, rev)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 1)
      `,
      [userId, planId, type, title, startDate, endDate, payload, now, now, clientId, requestId]
    );
    return { id: planId, rev: 1, updated_at: now };
  }

  await connection.query(
    `
      UPDATE long_term_plans
      SET type = ?,
          title = ?,
          start_date = ?,
          end_date = ?,
          payload = ?,
          deleted_at = NULL,
          client_id = ?,
          last_request_id = ?,
          updated_at = ?,
          rev = rev + 1
      WHERE user_id = ? AND id = ?
    `,
    [type, title, startDate, endDate, payload, clientId, requestId, now, userId, planId]
  );

  const [afterRows] = await connection.query(
    `SELECT rev, updated_at FROM long_term_plans WHERE user_id = ? AND id = ? LIMIT 1`,
    [userId, planId]
  );
  const after = afterRows[0];
  return { id: planId, rev: after?.rev ?? (existing.rev + 1), updated_at: after?.updated_at ?? now };
}

/**
 * 创建（幂等 upsert）
 * POST /api/plans/long-term
 */
router.post("/", async (req, res) => {
  const userId = req.userId;
  const body = req.body || {};
  const clientId = normalizeClientId(body.client_id ?? body.clientId);
  const requestId = normalizeRequestId(body.request_id ?? body.requestId);
  const plan = body.plan && typeof body.plan === "object" ? body.plan : body;
  const normalizedPlan = { ...plan, client_id: clientId, request_id: requestId };
  let connection;

  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const result = await upsertPlan(connection, userId, normalizedPlan, null);
    await connection.commit();
    connection.release();

    res.json({
      plan: {
        id: result.id,
        rev: result.rev,
        updated_at: toIso(result.updated_at)
      }
    });
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}

    const status = err?.status || 500;
    console.error("[创建/更新长期主义计划错误]", err);
    if (status === 409) {
      return res.status(409).json({ error: "CONFLICT", message: err.message, server_rev: err.server_rev ?? null });
    }
    res.status(status).json({ error: status === 400 ? err.message : "创建/更新长期主义计划失败" });
  }
});

/**
 * 删除（软删除 + 同步删除活动）
 * DELETE /api/plans/long-term/:id
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
        FROM long_term_plans
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
        code: "CONFLICT",
        server_rev: existing.rev
      });
    }

    if (!existing.deleted_at) {
      await connection.query(
        `
          UPDATE long_term_plans
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
      // 已删：仍写 last_request_id，保证幂等重放不会反复触发冲突
      await connection.query(
        `
          UPDATE long_term_plans
          SET client_id = ?,
              last_request_id = ?,
              updated_at = ?,
              rev = rev
          WHERE user_id = ? AND id = ?
        `,
        [clientId, requestId, now, userId, id]
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

    console.error("[删除长期主义计划错误]", err);
    if (err?.status === 409) {
      return res.status(409).json({ error: "CONFLICT", message: err.message, server_rev: err.server_rev ?? null });
    }
    res.status(500).json({ error: "删除长期主义计划失败" });
  }
});

export default router;

