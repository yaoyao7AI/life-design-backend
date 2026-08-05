-- Sync tables for Todo / LongTermPlan (MySQL)
-- 建议在 life_design 库执行。字段使用 DATETIME(3)（UTC）以支持毫秒级增量同步。

USE life_design;

-- =========================
-- 8. Todo 主表 todos（可同步）
-- =========================
CREATE TABLE IF NOT EXISTS todos (
  user_id BIGINT NOT NULL,
  id VARCHAR(128) NOT NULL,
  content VARCHAR(200) NOT NULL,
  tag VARCHAR(20) NULL,
  priority TINYINT NULL,
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

-- =================================
-- 9. Todo 附件表 todo_attachments（可同步）
-- =================================
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

-- ==================================
-- 10. 长期主义计划 long_term_plans（可同步）
-- ==================================
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

-- ======================================
-- 11. 长期主义活动 long_term_activities（可同步）
-- ======================================
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

-- ======================================
-- 12. 愿景板待办 vision_board_todos
-- ======================================
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

-- ======================================
-- 13. 设计人生周报 weekly_reports
-- ======================================
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


