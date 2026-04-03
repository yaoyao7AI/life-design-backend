-- Weekly Reports 周报表（MySQL）
-- 存储用户每周生成的生活周报数据

USE life_design;

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
