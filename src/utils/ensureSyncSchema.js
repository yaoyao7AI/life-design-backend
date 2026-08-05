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
      id VARCHAR(128) NOT NULL,
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
      vision_board_id VARCHAR(64) NULL,
      emotion_before VARCHAR(32) NULL,
      emotion_after VARCHAR(32) NULL,
      energy_before INT NULL,
      energy_after INT NULL,
      is_active_choice TINYINT(1) NULL,
      engagement_level INT NULL,
      completion_feeling VARCHAR(64) NULL,
      life_dimension VARCHAR(20) NULL,
      behavior_type VARCHAR(20) NULL,
      ai_tags JSON NULL,
      energy_feedback VARCHAR(20) NULL,
      meaning_feedback VARCHAR(20) NULL,
      reflection_note TEXT NULL,
      PRIMARY KEY (user_id, id),
      KEY idx_todos_user_updated (user_id, updated_at, id),
      KEY idx_todos_user_deleted (user_id, deleted_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const createTodoAttachments = `
    CREATE TABLE IF NOT EXISTS todo_attachments (
      user_id BIGINT NOT NULL,
      id VARCHAR(128) NOT NULL,
      todo_id VARCHAR(128) NOT NULL,
      type ENUM('image','video','file') NOT NULL,
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
      id VARCHAR(128) NOT NULL,
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
      id VARCHAR(128) NOT NULL,
      plan_id VARCHAR(128) NOT NULL,
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  const createWeeklyReportAiLogs = `
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
      linked_todo_id VARCHAR(128) NULL,
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
    await pool.query(createWeeklyReportAiLogs);

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

    async function ensureVarcharMinLength(table, column, minLength, columnDefSql) {
      const [cols] = await pool.query(
        "SHOW COLUMNS FROM " + table + " LIKE ?",
        [column]
      );
      if (cols.length === 0) return;
      const currentType = String(cols[0]?.Type || "").toLowerCase();
      const match = /^varchar\((\d+)\)$/.exec(currentType);
      if (match && Number(match[1]) >= minLength) return;
      log(`表 ${table}.${column} 当前类型 ${cols[0]?.Type || "unknown"}，尝试扩容到 VARCHAR(${minLength})…`);
      await pool.query(`ALTER TABLE ${table} MODIFY COLUMN ${columnDefSql}`);
      log(`✅ 已扩容 ${table}.${column} -> VARCHAR(${minLength})`);
    }

    async function hasConstraint(table, constraintName) {
      const [rows] = await pool.query(
        `
          SELECT 1
          FROM information_schema.TABLE_CONSTRAINTS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = ?
            AND CONSTRAINT_NAME = ?
          LIMIT 1
        `,
        [table, constraintName]
      );
      return rows.length > 0;
    }

    async function ensureSyncIdColumns() {
      const todoAttachmentFkName = "fk_todo_attachments_todos";
      const longTermActivitiesFkName = "fk_long_term_activities_plans";

      const hasTodoAttachmentFk = await hasConstraint("todo_attachments", todoAttachmentFkName);
      if (hasTodoAttachmentFk) {
        await pool.query(`ALTER TABLE todo_attachments DROP FOREIGN KEY ${todoAttachmentFkName}`);
      }
      await ensureVarcharMinLength("todos", "id", 128, "id VARCHAR(128) NOT NULL");
      await ensureVarcharMinLength("todo_attachments", "id", 128, "id VARCHAR(128) NOT NULL");
      await ensureVarcharMinLength("todo_attachments", "todo_id", 128, "todo_id VARCHAR(128) NOT NULL");
      if (hasTodoAttachmentFk) {
        await pool.query(`
          ALTER TABLE todo_attachments
          ADD CONSTRAINT ${todoAttachmentFkName}
            FOREIGN KEY (user_id, todo_id) REFERENCES todos(user_id, id)
              ON DELETE RESTRICT ON UPDATE CASCADE
        `);
      }

      const hasLongTermActivitiesFk = await hasConstraint(
        "long_term_activities",
        longTermActivitiesFkName
      );
      if (hasLongTermActivitiesFk) {
        await pool.query(
          `ALTER TABLE long_term_activities DROP FOREIGN KEY ${longTermActivitiesFkName}`
        );
      }
      await ensureVarcharMinLength("long_term_plans", "id", 128, "id VARCHAR(128) NOT NULL");
      await ensureVarcharMinLength(
        "long_term_activities",
        "id",
        128,
        "id VARCHAR(128) NOT NULL"
      );
      await ensureVarcharMinLength(
        "long_term_activities",
        "plan_id",
        128,
        "plan_id VARCHAR(128) NOT NULL"
      );
      if (hasLongTermActivitiesFk) {
        await pool.query(`
          ALTER TABLE long_term_activities
          ADD CONSTRAINT ${longTermActivitiesFkName}
            FOREIGN KEY (user_id, plan_id) REFERENCES long_term_plans(user_id, id)
              ON DELETE RESTRICT ON UPDATE CASCADE
        `);
      }

      await ensureVarcharMinLength(
        "vision_board_todos",
        "linked_todo_id",
        128,
        "linked_todo_id VARCHAR(128) NULL"
      );
    }

    async function ensureTodoAttachmentTypeEnum() {
      const [cols] = await pool.query("SHOW COLUMNS FROM todo_attachments LIKE 'type'");
      if (cols.length === 0) return;
      const currentType = String(cols[0]?.Type || "").toLowerCase();
      if (currentType.includes("'file'")) return;
      log("表 todo_attachments.type 缺少 file 枚举值，尝试补齐…");
      await pool.query(
        "ALTER TABLE todo_attachments MODIFY COLUMN type ENUM('image','video','file') NOT NULL"
      );
      log("✅ 已补齐 todo_attachments.type 枚举值 file");
    }

    await ensureColumn("todos", "last_request_id", "last_request_id VARCHAR(64) NULL");
    await ensureColumn("todos", "source", "source VARCHAR(32) NULL AFTER rev");
    await ensureColumn("todos", "vision_id", "vision_id BIGINT UNSIGNED NULL AFTER source");
    await ensureColumn("todos", "vision_board_id", "vision_board_id VARCHAR(64) NULL AFTER vision_id");
    await ensureColumn("todos", "emotion_before", "emotion_before VARCHAR(32) NULL");
    await ensureColumn("todos", "emotion_after", "emotion_after VARCHAR(32) NULL");
    await ensureColumn("todos", "energy_before", "energy_before INT NULL");
    await ensureColumn("todos", "energy_after", "energy_after INT NULL");
    await ensureColumn("todos", "is_active_choice", "is_active_choice TINYINT(1) NULL");
    await ensureColumn("todos", "engagement_level", "engagement_level INT NULL");
    await ensureColumn("todos", "completion_feeling", "completion_feeling VARCHAR(64) NULL");
    await ensureColumn("todos", "life_dimension", "life_dimension VARCHAR(20) NULL");
    await ensureColumn("todos", "behavior_type", "behavior_type VARCHAR(20) NULL");
    await ensureColumn("todos", "ai_tags", "ai_tags JSON NULL");
    await ensureColumn("todos", "energy_feedback", "energy_feedback VARCHAR(20) NULL AFTER ai_tags");
    await ensureColumn("todos", "meaning_feedback", "meaning_feedback VARCHAR(20) NULL AFTER energy_feedback");
    await ensureColumn("todos", "reflection_note", "reflection_note TEXT NULL");
    await ensureColumn("todos", "priority", "priority TINYINT NULL AFTER tag");
    await ensureColumn("long_term_plans", "payload", "payload JSON NULL");
    await ensureColumn("long_term_plans", "last_request_id", "last_request_id VARCHAR(64) NULL");
    await ensureColumn("vision_board_todos", "image_url", "image_url VARCHAR(1024) NULL AFTER content");
    await ensureColumn("weekly_reports", "health_score", "health_score DECIMAL(5,2) NULL");
    await ensureColumn("weekly_reports", "work_score", "work_score DECIMAL(5,2) NULL");
    await ensureColumn("weekly_reports", "play_score", "play_score DECIMAL(5,2) NULL");
    await ensureColumn("weekly_reports", "love_score", "love_score DECIMAL(5,2) NULL");
    await ensureColumn("weekly_reports", "energy_score", "energy_score DECIMAL(5,2) NULL");
    await ensureColumn("weekly_reports", "balance_score", "balance_score DECIMAL(5,2) NULL");
    await ensureColumn("weekly_reports", "coherence_score", "coherence_score DECIMAL(5,2) NULL");
    await ensureColumn("weekly_reports", "top_positive_behaviors", "top_positive_behaviors JSON NULL");
    await ensureColumn("weekly_reports", "top_negative_behaviors", "top_negative_behaviors JSON NULL");
    await ensureColumn("weekly_reports", "weekly_summary", "weekly_summary TEXT NULL");
    await ensureColumn("weekly_reports", "weekly_insight", "weekly_insight TEXT NULL");
    await ensureColumn("weekly_reports", "prototype_suggestions", "prototype_suggestions JSON NULL");
    await ensureColumn("weekly_reports", "radar_data", "radar_data JSON NULL");
    await ensureColumn("weekly_reports", "chart_data", "chart_data JSON NULL");
    await ensureColumn(
      "weekly_reports",
      "ai_status",
      "ai_status ENUM('generating','completed','failed','local_rule_generated') NOT NULL DEFAULT 'local_rule_generated'"
    );
    await ensureColumn("weekly_reports", "prompt_version", "prompt_version VARCHAR(32) NULL");
    await ensureColumn("weekly_reports", "model_version", "model_version VARCHAR(64) NULL");
    await ensureColumn("weekly_reports", "rule_version", "rule_version VARCHAR(32) NULL");
    await ensureSyncIdColumns();
    await ensureTodoAttachmentTypeEnum();

    log("✅ 同步表已就绪");
  } catch (err) {
    log("❌ 自动建表失败（不阻塞启动）:", err?.code, err?.message);
  }
}

