export function nowDate() {
  return new Date();
}

export function parseBool(v, defaultValue = false) {
  if (v === undefined || v === null) return defaultValue;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes";
}

export function parseLimit(v, defaultValue = 200, max = 500) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return defaultValue;
  return Math.min(Math.floor(n), max);
}

export function toMs(dt) {
  if (!dt) return null;
  const d = dt instanceof Date ? dt : new Date(dt);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * 游标格式："<updated_at_ms>:<id>"
 * - 允许 since 只传 ms（数字），等价于 "<ms>:"
 * - 允许 since 传 ISO 时间（如 "2026-02-02T12:00:00Z"）
 */
export function parseCursor(sinceOrCursor) {
  if (!sinceOrCursor) return { updatedAt: new Date(0), id: "" };
  const raw = String(sinceOrCursor);
  if (/^\d+$/.test(raw)) {
    const ms = Number(raw);
    return { updatedAt: new Date(ms), id: "" };
  }
  // 兼容 ISO 时间（注意 ISO 里也含 ":"，不能用 indexOf(":") 的老逻辑直接切）
  if (!/^\d+:.+$/.test(raw)) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) {
      return { updatedAt: new Date(ms), id: "" };
    }
  }
  const idx = raw.indexOf(":");
  if (idx === -1) return { updatedAt: new Date(0), id: "" };
  const msStr = raw.slice(0, idx);
  const id = raw.slice(idx + 1) || "";
  const ms = Number(msStr);
  return {
    updatedAt: Number.isFinite(ms) ? new Date(ms) : new Date(0),
    id
  };
}

export function makeCursor(updatedAtDate, id) {
  const ms = toMs(updatedAtDate) ?? 0;
  return `${ms}:${id || ""}`;
}

export function normalizeTodoTag(tag) {
  if (tag === undefined || tag === null || tag === "") return null;
  const t = String(tag).trim();
  const map = {
    work: "工作",
    health: "健康",
    interest: "兴趣",
    love: "爱"
  };
  if (map[t]) return map[t];
  // 兼容中文直接存
  return t;
}

