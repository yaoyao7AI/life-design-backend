import { Router } from "express";
import { authenticateToken } from "../middleware/auth.js";
import {
  generateReportData,
  getCurrentWeekRange,
  getWeekRangeByOffset
} from "../utils/weeklyReportLifeDesignUtils.js";
import { pool } from "../db.js";

const router = Router();
const WEEKLY_ENGINE_VERSION = "weekly-life-report-local-v2";

router.use(authenticateToken);

function isDateOnlyString(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function toDateOnlyFromAny(input) {
  if (input == null || String(input).trim() === "") return null;
  const raw = String(input).trim();
  if (isDateOnlyString(raw)) return raw;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function addDays(dateOnly, days) {
  const d = new Date(`${dateOnly}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pickFirstDefined(obj, keys) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && String(obj[k]).trim() !== "") {
      return obj[k];
    }
  }
  return undefined;
}

function normalizeOffset(rawOffset) {
  const offset = Number(rawOffset);
  if (!Number.isInteger(offset)) return null;
  // 兼容前端「1=1周前、2=2周前」习惯写法
  const normalized = offset > 0 ? -offset : offset;
  if (normalized < -52 || normalized > 0) return null;
  return normalized;
}

function resolveWeekRange(body, query) {
  const reqBody = body && typeof body === "object" ? body : {};
  const reqQuery = query && typeof query === "object" ? query : {};

  const startRaw = pickFirstDefined(reqBody, ["week_start", "weekStart", "start_date", "startDate", "week"]);
  const endRaw = pickFirstDefined(reqBody, ["week_end", "weekEnd", "end_date", "endDate"]);
  const fallbackDateRaw = pickFirstDefined(reqBody, ["date", "target_date", "targetDate"]);

  const startDate = toDateOnlyFromAny(startRaw ?? fallbackDateRaw);
  const endDate = toDateOnlyFromAny(endRaw);
  const hasStart = !!startDate;
  const hasEnd = !!endDate;

  if (hasStart || hasEnd) {
    if (hasStart && !hasEnd) {
      const computedEnd = addDays(startDate, 6);
      if (!computedEnd) return { error: "week_start 日期非法" };
      return { start: startDate, end: computedEnd };
    }
    if (!hasStart && hasEnd) {
      return { error: "仅传 week_end 时无法确定周起始日期，请补充 week_start" };
    }
    if (!startDate || !endDate) {
      return { error: "week_start / week_end 格式需为 YYYY-MM-DD（或可解析日期）" };
    }
    return { start: startDate, end: endDate };
  }

  const rawOffset =
    pickFirstDefined(reqBody, ["week_offset", "weekOffset", "offset"]) ??
    pickFirstDefined(reqQuery, ["week_offset", "weekOffset", "offset"]);

  if (rawOffset === undefined) {
    return getCurrentWeekRange();
  }

  const normalizedOffset = normalizeOffset(rawOffset);
  if (normalizedOffset === null) {
    return { error: "week_offset/offset 须为 0 到 52 的整数（正数代表过去几周）" };
  }
  return getWeekRangeByOffset(normalizedOffset);
}

/**
 * 兼容前端历史接口：
 * - /api/ai/weekly-life-report
 * - /api/weekly-life-report
 * - /ai/weekly-life-report（反向代理剥离 /api 时）
 *
 * 说明：
 * - 不依赖 DeepSeek，始终可走本地规则引擎，避免 503
 * - 返回兼容字段：ok + data + report_data
 */
async function handleWeeklyLifeReport(req, res) {
  try {
    res.setHeader("X-Weekly-Engine-Version", WEEKLY_ENGINE_VERSION);
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({
        ok: false,
        error: "未登录",
        engine_version: WEEKLY_ENGINE_VERSION
      });
    }

    const range = resolveWeekRange(req.body, req.query);
    if (range.error) {
      return res.status(400).json({
        ok: false,
        error: range.error,
        engine_version: WEEKLY_ENGINE_VERSION
      });
    }

    const reportData = await generateReportData(pool, userId, range.start, range.end);
    return res.json({
      ok: true,
      provider: "local-rule-engine",
      engine_version: WEEKLY_ENGINE_VERSION,
      week_start: range.start,
      week_end: range.end,
      data: reportData,
      report_data: reportData
    });
  } catch (err) {
    console.error("[AI_WEEKLY_LIFE_REPORT] 错误", err);
    return res.status(500).json({
      ok: false,
      error: "周报生成失败",
      engine_version: WEEKLY_ENGINE_VERSION
    });
  }
}

// 主路径
router.post("/weekly-life-report", handleWeeklyLifeReport);
router.get("/weekly-life-report", handleWeeklyLifeReport);

// 兼容路径：当路由挂载在 /api/weekly-life-report 或 /api/proxy/weekly-life-report 时可直接命中
router.post("/", handleWeeklyLifeReport);
router.get("/", handleWeeklyLifeReport);

export default router;
