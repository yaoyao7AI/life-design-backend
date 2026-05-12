import { Router } from "express";
import { pool } from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  generateReportData,
  getCurrentWeekRange,
  getWeekRangeByOffset,
} from "../utils/weeklyReportLifeDesignUtils.js";

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
          health_score DECIMAL(5,2) NULL,
          work_score DECIMAL(5,2) NULL,
          play_score DECIMAL(5,2) NULL,
          love_score DECIMAL(5,2) NULL,
          energy_score DECIMAL(5,2) NULL,
          balance_score DECIMAL(5,2) NULL,
          coherence_score DECIMAL(5,2) NULL,
          top_positive_behaviors JSON NULL,
          top_negative_behaviors JSON NULL,
          weekly_summary TEXT NULL,
          weekly_insight TEXT NULL,
          prototype_suggestions JSON NULL,
          radar_data JSON NULL,
          chart_data JSON NULL,
          status ENUM('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
          ai_status ENUM('generating','completed','failed','local_rule_generated') NOT NULL DEFAULT 'local_rule_generated',
          prompt_version VARCHAR(32) NULL,
          model_version VARCHAR(64) NULL,
          rule_version VARCHAR(32) NULL,
          report_data JSON NULL,
          error_message VARCHAR(500) NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          UNIQUE KEY uk_wr_user_week (user_id, week_start),
          KEY idx_wr_user_status (user_id, status),
          KEY idx_wr_user_updated (user_id, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `)
      .then(async () => {
        async function ensureColumn(column, ddl) {
          const [rows] = await pool.query("SHOW COLUMNS FROM weekly_reports LIKE ?", [column]);
          if (rows.length > 0) return;
          await pool.query(`ALTER TABLE weekly_reports ADD COLUMN ${ddl}`);
        }

        await ensureColumn("health_score", "health_score DECIMAL(5,2) NULL AFTER week_end");
        await ensureColumn("work_score", "work_score DECIMAL(5,2) NULL AFTER health_score");
        await ensureColumn("play_score", "play_score DECIMAL(5,2) NULL AFTER work_score");
        await ensureColumn("love_score", "love_score DECIMAL(5,2) NULL AFTER play_score");
        await ensureColumn("energy_score", "energy_score DECIMAL(5,2) NULL AFTER love_score");
        await ensureColumn("balance_score", "balance_score DECIMAL(5,2) NULL AFTER energy_score");
        await ensureColumn("coherence_score", "coherence_score DECIMAL(5,2) NULL AFTER balance_score");
        await ensureColumn("top_positive_behaviors", "top_positive_behaviors JSON NULL");
        await ensureColumn("top_negative_behaviors", "top_negative_behaviors JSON NULL");
        await ensureColumn("weekly_summary", "weekly_summary TEXT NULL");
        await ensureColumn("weekly_insight", "weekly_insight TEXT NULL");
        await ensureColumn("prototype_suggestions", "prototype_suggestions JSON NULL");
        await ensureColumn("radar_data", "radar_data JSON NULL");
        await ensureColumn("chart_data", "chart_data JSON NULL");
        await ensureColumn(
          "ai_status",
          "ai_status ENUM('generating','completed','failed','local_rule_generated') NOT NULL DEFAULT 'local_rule_generated' AFTER status"
        );
        await ensureColumn("prompt_version", "prompt_version VARCHAR(32) NULL AFTER ai_status");
        await ensureColumn("model_version", "model_version VARCHAR(64) NULL AFTER prompt_version");
        await ensureColumn("rule_version", "rule_version VARCHAR(32) NULL AFTER model_version");
        await pool.query(`
          CREATE TABLE IF NOT EXISTS weekly_report_ai_logs (
            id BIGINT PRIMARY KEY AUTO_INCREMENT,
            weekly_report_id BIGINT NOT NULL,
            user_id BIGINT NOT NULL,
            week_start DATE NOT NULL,
            prompt LONGTEXT NULL,
            response LONGTEXT NULL,
            tokens INT NULL,
            model VARCHAR(64) NULL,
            duration_ms INT NULL,
            prompt_version VARCHAR(32) NULL,
            model_version VARCHAR(64) NULL,
            rule_version VARCHAR(32) NULL,
            created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            KEY idx_wral_user_week (user_id, week_start),
            KEY idx_wral_report (weekly_report_id),
            CONSTRAINT fk_wral_report
              FOREIGN KEY (weekly_report_id) REFERENCES weekly_reports(id)
                ON DELETE CASCADE ON UPDATE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        return true;
      })
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

function normalizeStatus(status, hasReport) {
  if (!hasReport) return "not_generated";
  if (status === "completed" || status === "failed" || status === "generating") return status;
  if (status === "pending") return "generating";
  return "generating";
}

function normalizeAiStatus(aiStatus, status) {
  if (aiStatus === "generating" || aiStatus === "completed" || aiStatus === "failed" || aiStatus === "local_rule_generated") {
    return aiStatus;
  }
  if (status === "failed") return "failed";
  if (status === "generating") return "generating";
  return "completed";
}

function toArrayMaybe(v) {
  if (Array.isArray(v)) return v;
  return [];
}

function buildReportDataShape(row, reportData) {
  const raw = reportData && typeof reportData === "object" && !Array.isArray(reportData) ? reportData : {};
  const quadrantSource =
    raw.quadrant_dashboard && typeof raw.quadrant_dashboard === "object" ? raw.quadrant_dashboard : {};
  const scoreFromCol = (k) => (row?.[k] != null ? Number(row[k]) : null);
  const buildQuadrantItem = (key, fallbackScore) => {
    const src = quadrantSource[key];
    if (src && typeof src === "object") {
      return {
        score: Number.isFinite(Number(src.score)) ? Number(src.score) : fallbackScore,
        duration: src.duration ?? null,
        energy_status: src.energy_status ?? null,
        summary: src.summary ?? null
      };
    }
    return {
      score: fallbackScore,
      duration: null,
      energy_status: null,
      summary: null
    };
  };

  const radarRaw = raw.radar_data;
  let radarData = radarRaw ?? null;
  if (radarData && Array.isArray(radarData)) {
    radarData = radarData.map((item) => ({
      name: item?.name ?? "",
      score: Number.isFinite(Number(item?.score)) ? Number(item.score) : 0
    }));
  }

  const timeDist = raw.time_distribution && typeof raw.time_distribution === "object"
    ? raw.time_distribution
    : {};

  return {
    ...raw,
    main_insight: raw.main_insight ?? row?.weekly_insight ?? null,
    main_problem: raw.main_problem ?? null,
    main_direction: raw.main_direction ?? null,
    quadrant_dashboard: {
      health: buildQuadrantItem("health", scoreFromCol("health_score")),
      work: buildQuadrantItem("work", scoreFromCol("work_score")),
      play: buildQuadrantItem("play", scoreFromCol("play_score")),
      love: buildQuadrantItem("love", scoreFromCol("love_score"))
    },
    radar_data: radarData,
    time_distribution: {
      health_hours: Number.isFinite(Number(timeDist.health_hours)) ? Number(timeDist.health_hours) : null,
      work_hours: Number.isFinite(Number(timeDist.work_hours)) ? Number(timeDist.work_hours) : null,
      play_hours: Number.isFinite(Number(timeDist.play_hours)) ? Number(timeDist.play_hours) : null,
      love_hours: Number.isFinite(Number(timeDist.love_hours)) ? Number(timeDist.love_hours) : null,
      total_hours: Number.isFinite(Number(timeDist.total_hours)) ? Number(timeDist.total_hours) : null
    },
    top_positive_behaviors: toArrayMaybe(raw.top_positive_behaviors).slice(0, 3),
    top_negative_behaviors: toArrayMaybe(raw.top_negative_behaviors).slice(0, 3),
    vision_alignment:
      raw.vision_alignment && typeof raw.vision_alignment === "object"
        ? {
            aligned_visions: toArrayMaybe(raw.vision_alignment.aligned_visions),
            deviated_visions: toArrayMaybe(raw.vision_alignment.deviated_visions),
            summary: raw.vision_alignment.summary ?? null
          }
        : {
            aligned_visions: [],
            deviated_visions: [],
            summary: null
          },
    problem_type: raw.problem_type ?? null,
    problem_summary: raw.problem_summary ?? null,
    reframe_suggestion:
      (raw.reframe_suggestion && typeof raw.reframe_suggestion === "object")
        ? {
            original_problem: raw.reframe_suggestion.original_problem ?? null,
            reframed_problem: raw.reframe_suggestion.reframed_problem ?? null,
            small_action: raw.reframe_suggestion.small_action ?? null
          }
        : (raw.reframing && typeof raw.reframing === "object")
          ? {
              original_problem: raw.reframing.original_problem ?? null,
              reframed_problem: raw.reframing.reframed_problem ?? null,
              small_action: raw.reframing.small_action ?? null
            }
          : {
              original_problem: null,
              reframed_problem: null,
              small_action: null
            },
    reframing:
      (raw.reframing && typeof raw.reframing === "object")
        ? {
            original_problem: raw.reframing.original_problem ?? null,
            reframed_problem: raw.reframing.reframed_problem ?? null,
            small_action: raw.reframing.small_action ?? null
          }
        : {
            original_problem: null,
            reframed_problem: null,
            small_action: null
          },
    prototype_experiments: toArrayMaybe(raw.prototype_experiments)
  };
}

function formatReport(row) {
  const rawReportData = parseJsonMaybe(row.report_data) || {};
  const reportData = buildReportDataShape(row, rawReportData);
  const generatedAt = rawReportData.generated_at || toIso(row.updated_at);
  const status = normalizeStatus(row.status, true);
  return {
    id: String(row.id),
    week_start: toDateOnly(row.week_start),
    week_end: toDateOnly(row.week_end),
    generated_at: generatedAt,
    ai_status: normalizeAiStatus(row.ai_status || rawReportData.ai_status, status),
    health_score: row.health_score != null ? Number(row.health_score) : null,
    work_score: row.work_score != null ? Number(row.work_score) : null,
    play_score: row.play_score != null ? Number(row.play_score) : null,
    love_score: row.love_score != null ? Number(row.love_score) : null,
    energy_score: row.energy_score != null ? Number(row.energy_score) : null,
    balance_score: row.balance_score != null ? Number(row.balance_score) : null,
    coherence_score: row.coherence_score != null ? Number(row.coherence_score) : null,
    top_positive_behaviors: parseJsonMaybe(row.top_positive_behaviors) ?? [],
    top_negative_behaviors: parseJsonMaybe(row.top_negative_behaviors) ?? [],
    weekly_summary: row.weekly_summary ?? null,
    weekly_insight: row.weekly_insight ?? null,
    prototype_suggestions: parseJsonMaybe(row.prototype_suggestions) ?? [],
    radar_data: parseJsonMaybe(row.radar_data),
    chart_data: parseJsonMaybe(row.chart_data),
    status,
    report_data: reportData,
    error_message: row.error_message ?? null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function formatReportSummary(row) {
  const reportData = parseJsonMaybe(row.report_data) || {};
  const status = normalizeStatus(row.status, true);
  return {
    id: String(row.id),
    week_start: toDateOnly(row.week_start),
    week_end: toDateOnly(row.week_end),
    status,
    generated_at: reportData.generated_at || toIso(row.updated_at),
    ai_status: normalizeAiStatus(row.ai_status || reportData.ai_status, status),
    health_score: row.health_score != null ? Number(row.health_score) : null,
    work_score: row.work_score != null ? Number(row.work_score) : null,
    play_score: row.play_score != null ? Number(row.play_score) : null,
    love_score: row.love_score != null ? Number(row.love_score) : null,
    balance_score: row.balance_score != null ? Number(row.balance_score) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function formatTopBarMeta(row, fallbackRange = null) {
  if (!row) {
    return {
      status: "not_generated",
      week_start: fallbackRange?.start || null,
      week_end: fallbackRange?.end || null,
      generated_at: null,
      ai_status: null
    };
  }
  const reportData = parseJsonMaybe(row.report_data) || {};
  const status = normalizeStatus(row.status, true);
  return {
    status,
    week_start: toDateOnly(row.week_start),
    week_end: toDateOnly(row.week_end),
    generated_at: reportData.generated_at || toIso(row.updated_at),
    ai_status: normalizeAiStatus(row.ai_status || reportData.ai_status, status)
  };
}

function parseDateValue(v) {
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function isDateOnlyString(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function normalizeWeekOffsetInput(value) {
  const offset = Number(value);
  if (!Number.isInteger(offset)) return null;
  // 兼容前端写法：1=1周前，2=2周前
  const normalized = offset > 0 ? -offset : offset;
  if (normalized > 0 || normalized < -52) return null;
  return normalized;
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
  const offset = normalizeWeekOffsetInput(b.week_offset);
  if (offset === null) {
    return { error: "week_offset 须为 0 到 52 的整数（正数代表过去几周）" };
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

async function insertAiGenerationLog({
  reportId,
  userId,
  weekStart,
  prompt,
  response,
  tokens,
  model,
  durationMs,
  promptVersion,
  modelVersion,
  ruleVersion
}) {
  try {
    await pool.query(
      `INSERT INTO weekly_report_ai_logs
         (weekly_report_id, user_id, week_start, prompt, response, tokens, model, duration_ms, prompt_version, model_version, rule_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        userId,
        weekStart,
        prompt || null,
        response || null,
        Number.isFinite(Number(tokens)) ? Number(tokens) : null,
        model || null,
        Number.isFinite(Number(durationMs)) ? Number(durationMs) : null,
        promptVersion || null,
        modelVersion || null,
        ruleVersion || null
      ]
    );
  } catch (err) {
    console.warn("[weekly_report_ai_logs] 写入失败:", err?.message || err);
  }
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
          id: null,
          status: "not_generated",
          week_start: start,
          week_end: end,
          generated_at: null,
          ai_status: null,
          error_message: null,
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
      `SELECT id, week_start, week_end, status,
              health_score, work_score, play_score, love_score, balance_score,
              created_at, updated_at
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
 * 获取指定周周报详情（按 week_start）
 * GET /api/weekly-reports/:week_start
 */
router.get("/:week_start", async (req, res) => {
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const { week_start: weekStart } = req.params;
    if (!isDateOnlyString(weekStart)) {
      return res.status(400).json({ error: "week_start 格式需为 YYYY-MM-DD" });
    }

    const [rows] = await pool.query(
      `SELECT * FROM weekly_reports
       WHERE user_id = ? AND week_start = ?
       LIMIT 1`,
      [userId, weekStart]
    );

    if (rows.length === 0) {
      const rangeStart = parseDateValue(`${weekStart}T00:00:00`);
      const rangeEnd = rangeStart ? new Date(rangeStart) : null;
      if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 6);
      return res.json({
        success: true,
        data: {
          id: null,
          ...formatTopBarMeta(null, {
            start: weekStart,
            end: rangeEnd ? toDateOnly(rangeEnd) : null
          }),
          error_message: null,
          report_data: null
        }
      });
    }

    const report = formatReport(rows[0]);
    return res.json({
      success: true,
      data: {
        ...formatTopBarMeta(rows[0]),
        ...report
      },
    });
  } catch (err) {
    console.error("[按周获取周报错误]", err);
    return res.status(500).json({ error: "获取周报失败" });
  }
});

/**
 * 获取周报行为明细（分页）
 * GET /api/weekly-reports/:id/behaviors
 */
router.get("/:id/behaviors", async (req, res) => {
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: "id 非法" });
    }

    const [reportRows] = await pool.query(
      `SELECT id, week_start, week_end
       FROM weekly_reports
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId]
    );
    if (!reportRows.length) {
      return res.status(404).json({ error: "周报不存在" });
    }

    const weekStart = toDateOnly(reportRows[0].week_start);
    const weekEnd = toDateOnly(reportRows[0].week_end);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const filters = ["user_id = ?", "deleted_at IS NULL", "updated_at >= ?", "updated_at < DATE_ADD(?, INTERVAL 1 DAY)"];
    const args = [userId, weekStart, weekEnd];

    const lifeDimension = req.query.dimension != null ? String(req.query.dimension).trim() : "";
    if (lifeDimension) {
      filters.push("life_dimension = ?");
      args.push(lifeDimension);
    }

    const completedRaw = req.query.completed;
    if (completedRaw === "1" || completedRaw === "0" || completedRaw === "true" || completedRaw === "false") {
      const completed = completedRaw === "1" || completedRaw === "true" ? 1 : 0;
      filters.push("completed = ?");
      args.push(completed);
    }

    const energyMin = Number(req.query.energy_min);
    if (Number.isFinite(energyMin)) {
      filters.push("energy_after >= ?");
      args.push(energyMin);
    }
    const energyMax = Number(req.query.energy_max);
    if (Number.isFinite(energyMax)) {
      filters.push("energy_after <= ?");
      args.push(energyMax);
    }

    const whereSql = filters.join(" AND ");
    const [rows] = await pool.query(
      `SELECT id, content, completed, due_at, life_dimension, behavior_type, ai_tags, energy_before, energy_after, updated_at, completed_at, completion_feeling
       FROM todos
       WHERE ${whereSql}
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM todos
       WHERE ${whereSql}`,
      args
    );

    const items = rows.map((row) => {
      const aiTags = parseJsonMaybe(row.ai_tags);
      const aiTagsArray = Array.isArray(aiTags) ? aiTags : [];
      return {
        id: String(row.id),
        title: row.content,
        content: row.content,
        completed: !!row.completed,
        due_at: toIso(row.due_at),
        life_dimension: row.life_dimension ?? aiTags?.life_dimension ?? null,
        behavior_type: row.behavior_type ?? aiTags?.behavior_type ?? null,
        energy_before: row.energy_before != null ? Number(row.energy_before) : null,
        energy_after: row.energy_after != null ? Number(row.energy_after) : null,
        ai_tags: aiTagsArray,
        completion_feeling: row.completion_feeling ?? null,
        updated_at: toIso(row.updated_at),
        completed_at: toIso(row.completed_at)
      };
    });

    return res.json({
      success: true,
      data: {
        report_id: String(id),
        week_start: weekStart,
        week_end: weekEnd,
        items,
        total: Number(countRows[0]?.total || 0),
        limit,
        offset
      }
    });
  } catch (err) {
    console.error("[周报行为明细错误]", err);
    return res.status(500).json({ error: "获取周报行为明细失败" });
  }
});

/**
 * 获取 AI 分析详情（高级模式）
 * GET /api/weekly-reports/:id/ai-details
 */
router.get("/:id/ai-details", async (req, res) => {
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: "id 非法" });
    }
    const [reportRows] = await pool.query(
      `SELECT id, week_start, week_end, status, ai_status, report_data, prompt_version, model_version, rule_version, updated_at
       FROM weekly_reports
       WHERE id = ? AND user_id = ?
       LIMIT 1`,
      [id, userId]
    );
    if (!reportRows.length) {
      return res.status(404).json({ error: "周报不存在" });
    }

    const [rows] = await pool.query(
      `SELECT id, week_start, prompt, response, tokens, model, duration_ms, prompt_version, model_version, rule_version, created_at
       FROM weekly_report_ai_logs
       WHERE weekly_report_id = ? AND user_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [id, userId]
    );
    const reportRow = reportRows[0];
    const reportDataRaw = parseJsonMaybe(reportRow.report_data) || {};
    const reportData = buildReportDataShape(reportRow, reportDataRaw);
    const row = rows[0] || null;
    const analysisJson = row ? (parseJsonMaybe(row.response) ?? row.response ?? null) : null;
    const model = row?.model || reportDataRaw?.model || reportRow?.model_version || null;
    const provider = reportDataRaw?.provider || reportDataRaw?.ai_narrative?.provider || null;

    return res.json({
      success: true,
      data: {
        id: String(reportRow.id),
        week_start: toDateOnly(reportRow.week_start),
        week_end: toDateOnly(reportRow.week_end),
        status: normalizeStatus(reportRow.status, true),
        ai_status: normalizeAiStatus(reportRow.ai_status || reportDataRaw.ai_status, normalizeStatus(reportRow.status, true)),
        input_summary: String(row?.prompt || "").slice(0, 300) || null,
        provider,
        model,
        generated_at: toIso(row?.created_at || reportRow.updated_at),
        analysis_json: analysisJson,
        tokens: row?.tokens != null ? Number(row.tokens) : null,
        duration_ms: row?.duration_ms != null ? Number(row.duration_ms) : null,
        prompt_version: row?.prompt_version || reportRow?.prompt_version || null,
        model_version: row?.model_version || reportRow?.model_version || null,
        rule_version: row?.rule_version || reportRow?.rule_version || null,
        report_data: reportData
      }
    });
  } catch (err) {
    console.error("[周报AI详情错误]", err);
    return res.status(500).json({ error: "获取AI分析详情失败" });
  }
});

/**
 * 获取指定周报详情
 * GET /api/weekly-reports/:id
 */
router.get("/:id", async (req, res) => {
  try {
    await ensureWeeklyReportsSchema();
    const userId = req.userId;
    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) {
      return res.status(400).json({ error: "id 非法" });
    }

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
      const promptVersion = String(body.prompt_version || "weekly-report-v1");
      const modelVersion = String(body.model_version || body.model || "frontend-ai");
      const ruleVersion = String(body.rule_version || "weekly-rule-v1");
      const aiStatus = String(body.ai_status || "completed");

      if (existing.length > 0) {
        reportId = existing[0].id;
        await connection.query(
          `UPDATE weekly_reports
           SET status = 'completed',
               ai_status = ?,
               prompt_version = ?,
               model_version = ?,
               rule_version = ?,
               report_data = ?,
               top_positive_behaviors = COALESCE(?, top_positive_behaviors),
               top_negative_behaviors = COALESCE(?, top_negative_behaviors),
               weekly_summary = COALESCE(?, weekly_summary),
               weekly_insight = COALESCE(?, weekly_insight),
               prototype_suggestions = COALESCE(?, prototype_suggestions),
               radar_data = COALESCE(?, radar_data),
               chart_data = COALESCE(?, chart_data),
               error_message = NULL,
               week_end = ?,
               updated_at = NOW(3)
           WHERE id = ? AND user_id = ?`,
          [
            aiStatus,
            promptVersion,
            modelVersion,
            ruleVersion,
            dataJson,
            clientReportData.top_positive_behaviors
              ? JSON.stringify(clientReportData.top_positive_behaviors)
              : null,
            clientReportData.top_negative_behaviors
              ? JSON.stringify(clientReportData.top_negative_behaviors)
              : null,
            clientReportData.weekly_summary ?? null,
            clientReportData.weekly_insight ?? null,
            clientReportData.prototype_suggestions
              ? JSON.stringify(clientReportData.prototype_suggestions)
              : null,
            clientReportData.radar_data ? JSON.stringify(clientReportData.radar_data) : null,
            clientReportData.chart_data ? JSON.stringify(clientReportData.chart_data) : null,
            weekEnd,
            reportId,
            userId
          ]
        );
      } else {
        const [ins] = await connection.query(
          `INSERT INTO weekly_reports (
             user_id, week_start, week_end, status, report_data,
             ai_status, prompt_version, model_version, rule_version,
             health_score, work_score, play_score, love_score, energy_score, balance_score, coherence_score,
             top_positive_behaviors, top_negative_behaviors, weekly_summary, weekly_insight,
             prototype_suggestions, radar_data, chart_data
           )
           VALUES (?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            weekStart,
            weekEnd,
            dataJson,
            aiStatus,
            promptVersion,
            modelVersion,
            ruleVersion,
            clientReportData.health_score ?? null,
            clientReportData.work_score ?? null,
            clientReportData.play_score ?? null,
            clientReportData.love_score ?? null,
            clientReportData.energy_score ?? null,
            clientReportData.balance_score ?? null,
            clientReportData.coherence_score ?? null,
            clientReportData.top_positive_behaviors
              ? JSON.stringify(clientReportData.top_positive_behaviors)
              : null,
            clientReportData.top_negative_behaviors
              ? JSON.stringify(clientReportData.top_negative_behaviors)
              : null,
            clientReportData.weekly_summary ?? null,
            clientReportData.weekly_insight ?? null,
            clientReportData.prototype_suggestions
              ? JSON.stringify(clientReportData.prototype_suggestions)
              : null,
            clientReportData.radar_data ? JSON.stringify(clientReportData.radar_data) : null,
            clientReportData.chart_data ? JSON.stringify(clientReportData.chart_data) : null
          ]
        );
        reportId = ins.insertId;
      }

      await insertAiGenerationLog({
        reportId,
        userId,
        weekStart,
        prompt: body.prompt || null,
        response: dataJson,
        tokens: body.tokens,
        model: modelVersion,
        durationMs: body.duration ?? body.duration_ms,
        promptVersion,
        modelVersion,
        ruleVersion
      });

      await connection.commit();
      connection.release();
      connection = null;

      return res.json({
        success: true,
        data: {
          id: String(reportId),
          status: "completed",
          generated_at: new Date().toISOString(),
          ai_status: aiStatus,
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
          data: {
            id: String(row.id),
            status: "generating",
            ai_status: "generating",
            message: "周报正在生成中，请稍后查看"
          },
        });
      }
      reportId = row.id;
      await connection.query(
        `UPDATE weekly_reports
         SET status = 'generating',
             ai_status = 'generating',
             error_message = NULL,
             prompt_version = COALESCE(prompt_version, 'weekly-report-v1'),
             model_version = COALESCE(model_version, 'local-rule-engine'),
             rule_version = COALESCE(rule_version, 'weekly-rule-v1'),
             updated_at = NOW(3)
         WHERE id = ? AND user_id = ?`,
        [reportId, userId]
      );
    } else {
      const [ins] = await connection.query(
        `INSERT INTO weekly_reports (user_id, week_start, week_end, status, ai_status, prompt_version, model_version, rule_version)
         VALUES (?, ?, ?, 'generating', 'generating', 'weekly-report-v1', 'local-rule-engine', 'weekly-rule-v1')`,
        [userId, weekStart, weekEnd]
      );
      reportId = ins.insertId;
    }

    await connection.commit();
    connection.release();
    connection = null;

    setImmediate(async () => {
      const startedAt = Date.now();
      try {
        const reportData = await generateReportData(pool, userId, weekStart, weekEnd);
        const reportDataJson = JSON.stringify(reportData);
        const durationMs = Date.now() - startedAt;
        await pool.query(
          `UPDATE weekly_reports
           SET status = 'completed',
               ai_status = ?,
               report_data = ?,
               health_score = ?,
               work_score = ?,
               play_score = ?,
               love_score = ?,
               energy_score = ?,
               balance_score = ?,
               coherence_score = ?,
               top_positive_behaviors = ?,
               top_negative_behaviors = ?,
               weekly_summary = ?,
               weekly_insight = ?,
               prototype_suggestions = ?,
               radar_data = ?,
               chart_data = ?,
               error_message = NULL,
               updated_at = NOW(3)
           WHERE id = ? AND user_id = ?`,
          [
            reportData.ai_status || "local_rule_generated",
            reportDataJson,
            reportData.health_score ?? null,
            reportData.work_score ?? null,
            reportData.play_score ?? null,
            reportData.love_score ?? null,
            reportData.energy_score ?? null,
            reportData.balance_score ?? null,
            reportData.coherence_score ?? null,
            JSON.stringify(reportData.top_positive_behaviors || []),
            JSON.stringify(reportData.top_negative_behaviors || []),
            reportData.weekly_summary ?? null,
            reportData.weekly_insight ?? null,
            JSON.stringify(reportData.prototype_suggestions || []),
            JSON.stringify(reportData.radar_data || {}),
            JSON.stringify(reportData.chart_data || {}),
            reportId,
            userId
          ]
        );
        await insertAiGenerationLog({
          reportId,
          userId,
          weekStart,
          prompt: "local-rule-engine:weekly-report-v1",
          response: reportDataJson,
          tokens: null,
          model: "local-rule-engine",
          durationMs,
          promptVersion: "weekly-report-v1",
          modelVersion: "local-rule-engine",
          ruleVersion: "weekly-rule-v1"
        });
        console.log(`[WEEKLY_REPORT] 生成成功 user=${userId} week=${weekStart}`);
      } catch (genErr) {
        console.error(`[WEEKLY_REPORT] 生成失败 user=${userId} week=${weekStart}`, genErr);
        try {
          await pool.query(
            `UPDATE weekly_reports
             SET status = 'failed', ai_status = 'failed', error_message = ?, updated_at = NOW(3)
             WHERE id = ? AND user_id = ?`,
            [String(genErr?.message || "生成失败").slice(0, 500), reportId, userId]
          );
          await insertAiGenerationLog({
            reportId,
            userId,
            weekStart,
            prompt: "local-rule-engine:weekly-report-v1",
            response: String(genErr?.stack || genErr?.message || "生成失败"),
            tokens: null,
            model: "local-rule-engine",
            durationMs: Date.now() - startedAt,
            promptVersion: "weekly-report-v1",
            modelVersion: "local-rule-engine",
            ruleVersion: "weekly-rule-v1"
          });
        } catch {}
      }
    });

    return res.json({
      success: true,
      data: {
        id: String(reportId),
        status: "generating",
        ai_status: "generating",
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
    const promptVersion = String(body.prompt_version || "weekly-report-v1");
    const modelVersion = String(body.model_version || body.model || "frontend-ai");
    const ruleVersion = String(body.rule_version || "weekly-rule-v1");

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
         SET status = 'completed',
             ai_status = 'completed',
             prompt_version = ?,
             model_version = ?,
             rule_version = ?,
             report_data = ?, week_end = ?, error_message = NULL, updated_at = NOW(3)
         WHERE id = ? AND user_id = ?`,
        [promptVersion, modelVersion, ruleVersion, dataJson, weekEnd, reportId, userId]
      );
    } else {
      const [ins] = await connection.query(
        `INSERT INTO weekly_reports (
           user_id, week_start, week_end, status, ai_status, prompt_version, model_version, rule_version, report_data
         )
         VALUES (?, ?, ?, 'completed', 'completed', ?, ?, ?, ?)`,
        [userId, weekStart, weekEnd, promptVersion, modelVersion, ruleVersion, dataJson]
      );
      reportId = ins.insertId;
    }

    await insertAiGenerationLog({
      reportId,
      userId,
      weekStart,
      prompt: body.prompt || "frontend-ai upsert",
      response: dataJson,
      tokens: body.tokens,
      model: modelVersion,
      durationMs: body.duration ?? body.duration_ms,
      promptVersion,
      modelVersion,
      ruleVersion
    });

    await connection.commit();
    connection.release();
    connection = null;

    return res.json({
      success: true,
      data: {
        id: String(reportId),
        status: "completed",
        generated_at: new Date().toISOString(),
        ai_status: "completed",
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
