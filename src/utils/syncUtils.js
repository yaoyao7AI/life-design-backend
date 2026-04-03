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

function hasOwn(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * POST /api/todos 完成态解析：completed > done > status
 * （避免仅传 status: 'done' 时写库恒为未完成）
 */
export function parseCompletedFromTodo(todo) {
  if (!todo || typeof todo !== "object") return false;
  if (hasOwn(todo, "completed")) return parseBool(todo.completed, false);
  if (hasOwn(todo, "done")) return parseBool(todo.done, false);
  if (hasOwn(todo, "status")) {
    const s = String(todo.status).toLowerCase().trim();
    if (["done", "completed", "true", "1", "yes"].includes(s)) return true;
    if (
      ["pending", "todo", "open", "false", "0", "no", "incomplete", "unfinished"].includes(s)
    ) {
      return false;
    }
    return parseBool(todo.status, false);
  }
  return false;
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

