import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  generateReportData,
  getCurrentWeekRange,
  getWeekRangeByOffset,
} from "../utils/weeklyReportUtils.js";

const router = Router();
router.use(authenticateToken);

let weeklyReportsSchemaEnsuredPromise;

async function ensureWeeklyReportsSchema() {
  if (!weeklyReportsSchemaEnsuredPromise) {
    weeklyReportsSchemaEnsuredPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS weekly_reports (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          week_start DATE NOT NULL,
          week_end DATE NOT NULL,
          status ENUM('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
          report_data JSON NULL,
          error_message VARCHAR(500) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          UNIQUE KEY uk_wr_user_week (user_id, week_start),
          KEY idx_wr_user_status (user_id, status),
          KEY idx_wr_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(() => true)
      .catch((err) => {
        weeklyReportsSchemaEnsuredPromise = null;
        console.warn("[weekly_reports] 建表失败:", err?.message || err);
        throw err;
      });
  }
  return weeklyReportsSchemaEnsuredPromise;
}

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

function formatReport(row) {
  return {
    id: String(row.id),
    week_start: toDateOnly(row.week_start),
    week_end: toDateOnly(row.week_end),
    status: row.status,
    report_data: parseJsonMaybe(row.report_data),
    error_message: row.error_message ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function formatReportSummary(row) {
  return {
    id: String(row.id),
    week_start: toDateOnly(row.week_start),
    week_end: toDateOnly(row.week_end),
    status: row.status,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function isDateOnlyString(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * 解析周范围：优先显式 week_start + week_end；否则使用 week_offset（0=本周，-1=上周，…，最小 -52）。
 * @returns {{ start: string, end: string } | { error: string }}
 */
function resolveWeekRangeFromInput(body) {
  const b = body || {};
  const hasStart = b.week_start != null && String(b.week_start).trim() !== "";
  const hasEnd = b.week_end != null && String(b.week_end).trim() !== "";

  if (hasStart || hasEnd) {
    if (!hasStart || !hasEnd) {
      return { error: "week_start 与 week_end 需同时提供" };
    }
    if (!isDateOnlyString(b.week_start) || !isDateOnlyString(b.week_end)) {
      return { error: "week_start / week_end 格式需为 YYYY-MM-DD" };
    }
    return { start: b.week_start, end: b.week_end };
  }

  if (b.week_offset === undefined || b.week_offset === null || b.week_offset === "") {
    return {
      error: "请提供 week_start 与 week_end，或提供 week_offset（0 至 -52 的整数）",
    };
  }
  const offset = Number(b.week_offset);
  if (!Number.isInteger(offset) || offset > 0 || offset < -52) {
    return { error: "week_offset 须为 0 到 -52 的整数" };
  }
  return getWeekRangeByOffset(offset);
}

function mergeAiNarrativePayload(prevReportData, body) {
  const prev =
    prevReportData && typeof prevReportData === "object" && !Array.isArray(prevReportData)
      ? { ...prevReportData }
      : {};
  const prevAi = prev.ai_narrative;
  const base =
    prevAi && typeof prevAi === "object" && prevAi !== null && !Array.isArray(prevAi)
      ? { ...prevAi }
      : {};

  const raw = body.ai_narrative;
  let nextAi;
  if (Array.isArray(raw)) {
    nextAi = { ...base, items: raw };
  } else if (raw !== null && typeof raw === "object") {
    nextAi = { ...base, ...raw };
  } else {
    nextAi = { ...base, text: String(raw) };
  }

  if (body.fingerprint !== undefined) nextAi.fingerprint = body.fingerprint;
  if (body.provider !== undefined) nextAi.provider = body.provider;
  if (body.model !== undefined) nextAi.model = body.model;
  nextAi.source = body.source != null && body.source !== "" ? body.source : "frontend-ai";
  if (body.usage !== undefined) nextAi.usage = body.usage;
  if (body.meta !== undefined) nextAi.meta = body.meta;

  return { ...prev, ai_narrative: nextAi };
}

/**
 * 获取本周周报
 * GET /api/weekly-reports/current
 *
 * 如果本周还没有记录，返回 status: "not_generated"
 */
router.get("/current", async (req, res) => {
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const { start, end } = getCurrentWeekRange();

    const [rows] = await pool.query(
      `SELECT * FROM weekly_reports
       WHERE user_id = ? AND week_start = ?
       LIMIT 1`,
      [userId, start]
    );

    if (rows.length === 0) {
      return res.json({
        success: true,
        data: {
          status: "not_generated",
          week_start: start,
          week_end: end,
          report_data: null,
        },
      });
    }

    return res.json({
      success: true,
      data: formatReport(rows[0]),
    });
  } catch (err) {
    console.error("[获取本周周报错误]", err);
    return res.status(500).json({ error: "获取本周周报失败" });
  }
});

/**
 * 获取历史周报列表
 * GET /api/weekly-reports/history?limit=10&offset=0
 */
router.get("/history", async (req, res) => {
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 52);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [rows] = await pool.query(
      `SELECT id, week_start, week_end, status, created_at, updated_at
       FROM weekly_reports
       WHERE user_id = ?
       ORDER BY week_start DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM weekly_reports WHERE user_id = ?`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        items: rows.map(formatReportSummary),
        total: Number(countRows[0]?.total ?? 0),
        limit,
        offset,
      },
    });
  } catch (err) {
    console.error("[获取历史周报列表错误]", err);
    return res.status(500).json({ error: "获取历史周报列表失败" });
  }
});

/**
 * 获取指定周报详情
 * GET /api/weekly-reports/:id
 */
router.get("/:id(\\d+)", async (req, res) => {
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM weekly_reports
       WHERE user_id = ? AND id = ?
       LIMIT 1`,
      [userId, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "周报不存在" });
    }

    return res.json({
      success: true,
      data: formatReport(rows[0]),
    });
  } catch (err) {
    console.error("[获取周报详情错误]", err);
    return res.status(500).json({ error: "获取周报详情失败" });
  }
});

/**
 * 保存/生成周报
 * POST /api/weekly-reports/generate
 *
 * 两种模式：
 *   A（前端驱动）: body 含 report_data → 直接存库，status 立即 completed
 *   B（后端兜底）: body 不含 report_data → 后端从 todos 聚合生成
 *
 * Body:
 *   week_start + week_end: "YYYY-MM-DD"，或 week_offset: 0（本周）… -52
 *   report_data: { ... }      (可选；有则走模式 A)
 */
router.post("/generate", async (req, res) => {
  let connection;
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const body = req.body || {};

    const range = resolveWeekRangeFromInput(body);
    if (range.error) {
      return res.status(400).json({ error: range.error });
    }
    const weekStart = range.start;
    const weekEnd = range.end;

    const clientReportData = body.report_data && typeof body.report_data === "object"
      ? body.report_data
      : null;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT id, status FROM weekly_reports
       WHERE user_id = ? AND week_start = ?
       LIMIT 1
       FOR UPDATE`,
      [userId, weekStart]
    );

    let reportId;

    if (clientReportData) {
      // ── 模式 A：前端已算好，直接存 ──
      const dataJson = JSON.stringify(clientReportData);

      if (existing.length > 0) {
        reportId = existing[0].id;
        await connection.query(
          `UPDATE weekly_reports
           SET status = 'completed', report_data = ?, error_message = NULL, week_end = ?, updated_at = NOW(3)
           WHERE id = ? AND user_id = ?`,
          [dataJson, weekEnd, reportId, userId]
        );
      } else {
        const [ins] = await connection.query(
          `INSERT INTO weekly_reports (user_id, week_start, week_end, status, report_data)
           VALUES (?, ?, ?, 'completed', ?)`,
          [userId, weekStart, weekEnd, dataJson]
        );
        reportId = ins.insertId;
      }

      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: true,
        data: {
          id: String(reportId),
          status: "completed",
          week_start: weekStart,
          week_end: weekEnd,
        },
      });
    }

    // ── 模式 B：后端兜底聚合 ──
    if (existing.length > 0) {
      const row = existing[0];
      if (row.status === "generating") {
        await connection.commit();
        connection.release();
        connection = null;
        return res.json({
          success: true,
          data: { id: String(row.id), status: "generating", message: "周报正在生成中，请稍后查看" },
        });
      }
      reportId = row.id;
      await connection.query(
        `UPDATE weekly_reports SET status = 'generating', error_message = NULL, updated_at = NOW(3)
         WHERE id = ? AND user_id = ?`,
        [reportId, userId]
      );
    } else {
      const [ins] = await connection.query(
        `INSERT INTO weekly_reports (user_id, week_start, week_end, status)
         VALUES (?, ?, ?, 'generating')`,
        [userId, weekStart, weekEnd]
      );
      reportId = ins.insertId;
    }

    await connection.commit();
    connection.release();
    connection = null;

    setImmediate(async () => {
      try {
        const reportData = await generateReportData(pool, userId, weekStart, weekEnd);
        await pool.query(
          `UPDATE weekly_reports
           SET status = 'completed', report_data = ?, error_message = NULL, updated_at = NOW(3)
           WHERE id = ? AND user_id = ?`,
          [JSON.stringify(reportData), reportId, userId]
        );
        console.log(`[WEEKLY_REPORT] 生成成功 user=${userId} week=${weekStart}`);
      } catch (genErr) {
        console.error(`[WEEKLY_REPORT] 生成失败 user=${userId} week=${weekStart}`, genErr);
        try {
          await pool.query(
            `UPDATE weekly_reports
             SET status = 'failed', error_message = ?, updated_at = NOW(3)
             WHERE id = ? AND user_id = ?`,
            [String(genErr?.message || "生成失败").slice(0, 500), reportId, userId]
          );
        } catch {}
      }
    });

    return res.json({
      success: true,
      data: {
        id: String(reportId),
        status: "generating",
        week_start: weekStart,
        week_end: weekEnd,
        message: "周报开始生成，请稍后刷新查看",
      },
    });
  } catch (err) {
    try { if (connection) await connection.rollback(); } catch {}
    try { if (connection) connection.release(); } catch {}
    console.error("[触发生成周报错误]", err);
    return res.status(500).json({ error: "触发生成周报失败" });
  }
});

/**
 * 合并写入 AI 叙事（upsert），保留 report_data 中其它字段
 * POST /api/weekly-reports/upsert-ai
 *
 * Body: week_start + week_end 或 week_offset；ai_narrative（及可选 fingerprint/provider/model/source 等）
 */
router.post("/upsert-ai", async (req, res) => {
  let connection;
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const body = req.body || {};

    const range = resolveWeekRangeFromInput(body);
    if (range.error) {
      return res.status(400).json({ error: range.error });
    }
    if (body.ai_narrative === undefined) {
      return res.status(400).json({ error: "ai_narrative 必填" });
    }

    const weekStart = range.start;
    const weekEnd = range.end;

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query(
      `SELECT id, report_data FROM weekly_reports
       WHERE user_id = ? AND week_start = ?
       LIMIT 1
       FOR UPDATE`,
      [userId, weekStart]
    );

    const prevData = existing.length > 0 ? parseJsonMaybe(existing[0].report_data) : null;
    const merged = mergeAiNarrativePayload(prevData, body);
    const dataJson = JSON.stringify(merged);

    let reportId;
    if (existing.length > 0) {
      reportId = existing[0].id;
      await connection.query(
        `UPDATE weekly_reports
         SET report_data = ?, week_end = ?, error_message = NULL, updated_at = NOW(3)
         WHERE id = ? AND user_id = ?`,
        [dataJson, weekEnd, reportId, userId]
      );
    } else {
      const [ins] = await connection.query(
        `INSERT INTO weekly_reports (user_id, week_start, week_end, status, report_data)
         VALUES (?, ?, ?, 'completed', ?)`,
        [userId, weekStart, weekEnd, dataJson]
      );
      reportId = ins.insertId;
    }

    await connection.commit();
    connection.release();
    connection = null;

    return res.json({
      success: true,
      data: {
        id: String(reportId),
        status: "completed",
        week_start: weekStart,
        week_end: weekEnd,
      },
    });
  } catch (err) {
    try { if (connection) await connection.rollback(); } catch {}
    try { if (connection) connection.release(); } catch {}
    console.error("[upsert-ai 周报错误]", err);
    return res.status(500).json({ error: "保存 AI 叙事失败" });
  }
});

export default router;
