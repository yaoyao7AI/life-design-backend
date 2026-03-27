import { DateTime } from "luxon";

/**
 * 校验是否为 Luxon 可识别的 IANA 时区（如 Asia/Shanghai）。
 * 无法识别时返回 null，调用方应回退到 UTC 月语义。
 */
export function normalizeTimeZone(tz) {
  if (tz === undefined || tz === null) return null;
  const s = String(tz).trim();
  if (!s) return null;
  if (!DateTime.now().setZone(s).isValid) return null;
  return s;
}

/**
 * @param {string|null|undefined} month YYYY-MM
 * @param {string|null|undefined} timeZone IANA；为空则按 UTC 自然月解析（与历史行为一致）
 */
export function parseMonthRange(month, timeZone = null) {
  const raw = String(month || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthNum = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return null;
  }
  const zone = normalizeTimeZone(timeZone);
  if (!zone) {
    const start = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0));
    return { start, end };
  }
  const start = DateTime.fromObject({ year, month: monthNum, day: 1 }, { zone }).startOf("day");
  const end = start.plus({ months: 1 });
  return { start: start.toJSDate(), end: end.toJSDate() };
}

/**
 * @param {string|null|undefined} timeZone IANA；为空则当前 UTC 月
 */
export function currentMonthRange(timeZone = null) {
  const zone = normalizeTimeZone(timeZone);
  if (!zone) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth();
    return {
      start: new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(y, mo + 1, 1, 0, 0, 0, 0)),
    };
  }
  const now = DateTime.now().setZone(zone);
  const start = now.startOf("month");
  const end = start.plus({ months: 1 });
  return { start: start.toJSDate(), end: end.toJSDate() };
}

/**
 * 与前端约定：客户端用 IANA 名称传递日历上下文（如 Asia/Shanghai）。
 * - Query（与 visionTodos 对齐）：`tz`，兼容 `time_zone`、`timeZone`
 * - Header：`X-Time-Zone` / `X-Timezone`
 * 非法或缺失时返回 null，月份区间回退为 UTC（与历史行为一致）。仅带 `tz`、无按月逻辑的接口可忽略该参数。
 */
export function timeZoneFromRequest(req) {
  const q = req.query || {};
  const raw =
    q.tz ??
    q.time_zone ??
    q.timeZone ??
    req.headers["x-time-zone"] ??
    req.headers["x-timezone"] ??
    null;
  return normalizeTimeZone(raw);
}

/**
 * 愿景「按月」接口的统一区间：`month=YYYY-MM` 与 `tz` 同时参与解释（该月 = 客户端时区下的日历月）；
 * 仅有 `tz`、无 `month` 时用该时区的「当前月」；均无合法 tz 时 `month` 按 UTC 自然月。
 */
export function monthRangeFromVisionRequest(req) {
  const tz = timeZoneFromRequest(req);
  const month = req.query?.month;
  return parseMonthRange(month, tz) || currentMonthRange(tz);
}

export function toDateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}
