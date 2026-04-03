import { pool } from "../db.js";

function log(...args) {
  console.log("[SYNC_SCHEMA]", ...args);
}

/**
 * 可控的自动建表（默认关闭）。
 *
 * 开启方式：
 * - 设置环境变量 AUTO_MIGRATE_SYNC_SCHEMA=1
 *
 * 注意：
 * - 需要数据库账号具备建表权限
 * - 失败不阻塞服务启动（只打日志），便于线上排障
 */
export async function ensureSyncSchema() {
  if (process.env.AUTO_MIGRATE_SYNC_SCHEMA !== "1") return;

  log("AUTO_MIGRATE_SYNC_SCHEMA=1，开始确保同步表存在…");

  const createTodos = `
    CREATE TABLE IF NOT EXISTS todos (
      user_id BIGINT NOT NULL,
      id VARCHAR(64) NOT NULL,
      content VARCHAR(200) NOT NULL,
      tag VARCHAR(20) NULL,
      due_at DATETIME(3) NULL,
      completed TINYINT(1) NOT NULL DEFAULT 0,
      completed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL,
      client_id VARCHAR(64) NULL,
      last_request_id VARCHAR(64) NULL,
      rev INT NOT NULL DEFAULT 1,
      source VARCHAR(32) NULL,
      vision_id BIGINT UNSIGNED NULL,
      PRIMARY KEY (user_id, id),
      KEY idx_todos_user_updated (user_id, updated_at, id),
      KEY idx_todos_user_deleted (user_id, deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const createTodoAttachments = `
    CREATE TABLE IF NOT EXISTS todo_attachments (
      user_id BIGINT NOT NULL,
      id VARCHAR(64) NOT NULL,
      todo_id VARCHAR(64) NOT NULL,
      type ENUM('image','video') NOT NULL,
      url VARCHAR(1024) NOT NULL,
      file_name VARCHAR(255) NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL,
      client_id VARCHAR(64) NULL,
      rev INT NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, id),
      KEY idx_todo_attachments_todo (user_id, todo_id),
      CONSTRAINT fk_todo_attachments_todos
        FOREIGN KEY (user_id, todo_id) REFERENCES todos(user_id, id)
          ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const createLongTermPlans = `
    CREATE TABLE IF NOT EXISTS long_term_plans (
      user_id BIGINT NOT NULL,
      id VARCHAR(64) NOT NULL,
      title VARCHAR(200) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      type ENUM('daily','weekly','monthly') NOT NULL,
      payload JSON NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL,
      client_id VARCHAR(64) NULL,
      last_request_id VARCHAR(64) NULL,
      rev INT NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, id),
      KEY idx_ltp_user_updated (user_id, updated_at, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const createLongTermActivities = `
    CREATE TABLE IF NOT EXISTS long_term_activities (
      user_id BIGINT NOT NULL,
      id VARCHAR(64) NOT NULL,
      plan_id VARCHAR(64) NOT NULL,
      name VARCHAR(200) NOT NULL,
      start_time TIME NULL,
      duration_minutes INT NOT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      deleted_at DATETIME(3) NULL,
      client_id VARCHAR(64) NULL,
      rev INT NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, id),
      KEY idx_lta_plan (user_id, plan_id),
      KEY idx_lta_user_updated (user_id, updated_at, id),
      CONSTRAINT fk_long_term_activities_plans
        FOREIGN KEY (user_id, plan_id) REFERENCES long_term_plans(user_id, id)
          ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const createWeeklyReports = `
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const createVisionBoardTodos = `
    CREATE TABLE IF NOT EXISTS vision_board_todos (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      vision_board_id BIGINT NOT NULL,
      title VARCHAR(200) NULL,
      content TEXT NULL,
      image_url VARCHAR(1024) NULL,
      tag VARCHAR(20) NULL,
      occur_at DATETIME(3) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      linked_todo_id VARCHAR(64) NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      deleted_at DATETIME(3) NULL,
      KEY idx_vbt_user_board (user_id, vision_board_id),
      KEY idx_vbt_user_board_del_sort (user_id, vision_board_id, deleted_at, sort_order),
      KEY idx_vbt_user_linked (user_id, linked_todo_id),
      KEY idx_vbt_user_updated (user_id, updated_at, id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  try {
    // 外键依赖顺序：todos -> todo_attachments；long_term_plans -> long_term_activities
    await pool.query(createTodos);
    await pool.query(createLongTermPlans);
    await pool.query(createTodoAttachments);
    await pool.query(createLongTermActivities);
    await pool.query(createVisionBoardTodos);
    await pool.query(createWeeklyReports);

    // 老库已建表但缺列时，补齐关键同步字段
    async function ensureColumn(table, column, columnDefSql) {
      const [cols] = await pool.query(
        "SHOW COLUMNS FROM " + table + " LIKE ?",
        [column]
      );
      if (cols.length > 0) return;
      log(`表 ${table} 缺少列 ${column}，尝试补齐…`);
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDefSql}`);
      log(`✅ 已补齐 ${table}.${column}`);
    }

    await ensureColumn("todos", "last_request_id", "last_request_id VARCHAR(64) NULL");
    await ensureColumn("todos", "source", "source VARCHAR(32) NULL AFTER rev");
    await ensureColumn("todos", "vision_id", "vision_id BIGINT UNSIGNED NULL AFTER source");
    await ensureColumn("long_term_plans", "payload", "payload JSON NULL");
    await ensureColumn("long_term_plans", "last_request_id", "last_request_id VARCHAR(64) NULL");
    await ensureColumn("vision_board_todos", "image_url", "image_url VARCHAR(1024) NULL AFTER content");

    log("✅ 同步表已就绪");
  } catch (err) {
    log("❌ 自动建表失败（不阻塞启动）:", err?.code, err?.message);
  }
}

