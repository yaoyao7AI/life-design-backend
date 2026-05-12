import dotenv from "dotenv";
import { pool } from "../src/db.js";

dotenv.config();

function isDateOnlyString(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDays(dateOnly, days) {
  const d = new Date(`${dateOnly}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function run() {
  const userId = Number(process.argv[2] || 1);
  const weekStart = String(process.argv[3] || "");
  const errorMessage = String(process.argv[4] || "模拟失败：联调验收样本");

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("user_id 非法，示例：node scripts/mock-weekly-report-failed.js 1 2026-05-11");
  }
  if (!isDateOnlyString(weekStart)) {
    throw new Error("week_start 格式非法，需 YYYY-MM-DD");
  }

  const weekEnd = addDays(weekStart, 6);

  await pool.query(
    `INSERT INTO weekly_reports (user_id, week_start, week_end, status, ai_status, error_message)
     VALUES (?, ?, ?, 'failed', 'failed', ?)
     ON DUPLICATE KEY UPDATE
       week_end = VALUES(week_end),
       status = 'failed',
       ai_status = 'failed',
       error_message = VALUES(error_message),
       updated_at = NOW(3)`,
    [userId, weekStart, weekEnd, errorMessage.slice(0, 500)]
  );

  const [rows] = await pool.query(
    `SELECT id, user_id, week_start, week_end, status, ai_status, error_message, updated_at
     FROM weekly_reports
     WHERE user_id = ? AND week_start = ?
     LIMIT 1`,
    [userId, weekStart]
  );

  console.log(JSON.stringify({ success: true, data: rows[0] || null }));
  await pool.end();
}

run().catch(async (err) => {
  console.error(JSON.stringify({ success: false, error: err?.message || String(err) }));
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
