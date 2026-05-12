import { pool } from "../db.js";
import {
  generateReportData
} from "../utils/weeklyReportLifeDesignUtils.js";

function schedulerEnabled() {
  return process.env.WEEKLY_REPORT_SCHEDULER_ENABLED === "1";
}

function getTimeParts(now, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const map = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return {
    weekday: map.weekday,
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCurrentWeekRangeInTimezone(now, timeZone) {
  const local = new Date(now.toLocaleString("en-US", { timeZone }));
  const day = local.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(local);
  monday.setDate(local.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  };
}

async function ensureWeeklyReportsSchema() {
  await pool.query(`
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
  `);
}

async function listActiveUsers() {
  try {
    const [users] = await pool.query("SELECT id FROM users ORDER BY id ASC");
    if (users.length > 0) return users.map((u) => Number(u.id));
  } catch {}
  const [rows] = await pool.query(
    "SELECT DISTINCT user_id AS id FROM todos WHERE deleted_at IS NULL ORDER BY user_id ASC"
  );
  return rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0);
}

async function acquireSchedulerLock() {
  const [rows] = await pool.query("SELECT GET_LOCK('life_design_weekly_report_scheduler', 0) AS locked");
  return Number(rows?.[0]?.locked || 0) === 1;
}

async function releaseSchedulerLock() {
  try {
    await pool.query("SELECT RELEASE_LOCK('life_design_weekly_report_scheduler')");
  } catch {}
}

async function upsertWeeklyReportForUser(userId, weekStart, weekEnd) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existingRows] = await connection.query(
      `SELECT id, status
       FROM weekly_reports
       WHERE user_id = ? AND week_start = ?
       LIMIT 1
       FOR UPDATE`,
      [userId, weekStart]
    );

    let reportId;
    if (existingRows.length > 0) {
      reportId = existingRows[0].id;
      if (existingRows[0].status === "completed") {
        await connection.commit();
        connection.release();
        return;
      }
      await connection.query(
        `UPDATE weekly_reports
         SET status = 'generating',
             ai_status = 'generating',
             prompt_version = COALESCE(prompt_version, 'weekly-report-v1'),
             model_version = COALESCE(model_version, 'local-rule-engine'),
             rule_version = COALESCE(rule_version, 'weekly-rule-v1'),
             error_message = NULL,
             week_end = ?,
             updated_at = NOW(3)
         WHERE id = ? AND user_id = ?`,
        [weekEnd, reportId, userId]
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

    const reportData = await generateReportData(pool, userId, weekStart, weekEnd);
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
        JSON.stringify(reportData),
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
  } catch (err) {
    try {
      if (connection) await connection.rollback();
    } catch {}
    try {
      if (connection) connection.release();
    } catch {}
    await pool.query(
      `UPDATE weekly_reports
       SET status = 'failed', ai_status = 'failed', error_message = ?, updated_at = NOW(3)
       WHERE user_id = ? AND week_start = ?`,
      [String(err?.message || "生成失败").slice(0, 500), userId, weekStart]
    );
    console.error("[WEEKLY_REPORT_SCHEDULER] user 生成失败", { userId, weekStart, error: err?.message });
  }
}

export function startWeeklyReportScheduler() {
  if (!schedulerEnabled()) {
    console.log("[WEEKLY_REPORT_SCHEDULER] 未开启（WEEKLY_REPORT_SCHEDULER_ENABLED!=1）");
    return;
  }

  const timeZone = process.env.WEEKLY_REPORT_TIMEZONE || "Asia/Shanghai";
  const targetHour = Number(process.env.WEEKLY_REPORT_TARGET_HOUR || 22);
  const targetMinuteWindow = Number(process.env.WEEKLY_REPORT_TRIGGER_WINDOW_MINUTES || 5);
  const tickMs = Number(process.env.WEEKLY_REPORT_SCHEDULER_TICK_MS || 60000);
  let running = false;
  let lastTriggeredWeekStart = null;

  const tick = async () => {
    if (running) return;
    const now = new Date();
    const t = getTimeParts(now, timeZone);
    const inWindow = t.weekday === "Sun" && t.hour === targetHour && t.minute < targetMinuteWindow;
    if (!inWindow) return;

    const { start: weekStart, end: weekEnd } = getCurrentWeekRangeInTimezone(now, timeZone);
    if (lastTriggeredWeekStart === weekStart) return;

    running = true;
    try {
      const hasLock = await acquireSchedulerLock();
      if (!hasLock) return;

      try {
        await ensureWeeklyReportsSchema();
        const userIds = await listActiveUsers();
        for (const userId of userIds) {
          await upsertWeeklyReportForUser(userId, weekStart, weekEnd);
        }
        lastTriggeredWeekStart = weekStart;
        console.log(
          `[WEEKLY_REPORT_SCHEDULER] 自动周报完成 week=${weekStart} users=${userIds.length}`
        );
      } finally {
        await releaseSchedulerLock();
      }
    } catch (err) {
      console.error("[WEEKLY_REPORT_SCHEDULER] 执行失败", err);
    } finally {
      running = false;
    }
  };

  setInterval(tick, tickMs);
  setTimeout(tick, 5000);
  console.log(
    `[WEEKLY_REPORT_SCHEDULER] 已启动 tz=${timeZone} target=Sun ${String(targetHour).padStart(
      2,
      "0"
    )}:00`
  );
}
