export function parseMonthRange(month) {
  const raw = String(month || "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const monthNum = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) {
    return null;
  }
  const start = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthNum, 1, 0, 0, 0, 0));
  return { start, end };
}

export function currentMonthRange() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0)),
  };
}

export function toDateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  return d;
}
