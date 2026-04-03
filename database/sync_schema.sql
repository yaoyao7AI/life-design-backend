-- Sync tables for Todo / LongTermPlan (MySQL)
-- 建议在 life_design 库执行。字段使用 DATETIME(3)（UTC）以支持毫秒级增量同步。

USE life_design;

-- =========================
-- 8. Todo 主表 todos（可同步）
-- =========================
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

-- =================================
-- 9. Todo 附件表 todo_attachments（可同步）
-- =================================
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

-- ==================================
-- 10. 长期主义计划 long_term_plans（可同步）
-- ==================================
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

-- ======================================
-- 11. 长期主义活动 long_term_activities（可同步）
-- ======================================
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
  linked_todo_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  deleted_at DATETIME(3) NULL,
  KEY idx_vbt_user_board (user_id, vision_board_id),
  KEY idx_vbt_user_board_del_sort (user_id, vision_board_id, deleted_at, sort_order),
  KEY idx_vbt_user_linked (user_id, linked_todo_id),
  KEY idx_vbt_user_updated (user_id, updated_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

