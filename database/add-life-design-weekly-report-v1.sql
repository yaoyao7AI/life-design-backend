USE life_design;

-- todo 行为认知字段（《设计你的人生》V1）
ALTER TABLE todos ADD COLUMN emotion_before VARCHAR(32) NULL;
ALTER TABLE todos ADD COLUMN emotion_after VARCHAR(32) NULL;
ALTER TABLE todos ADD COLUMN energy_before INT NULL;
ALTER TABLE todos ADD COLUMN energy_after INT NULL;
ALTER TABLE todos ADD COLUMN is_active_choice TINYINT(1) NULL;
ALTER TABLE todos ADD COLUMN engagement_level INT NULL;
ALTER TABLE todos ADD COLUMN completion_feeling VARCHAR(64) NULL;
ALTER TABLE todos ADD COLUMN life_dimension VARCHAR(20) NULL;
ALTER TABLE todos ADD COLUMN behavior_type VARCHAR(20) NULL;
ALTER TABLE todos ADD COLUMN ai_tags JSON NULL;
ALTER TABLE todos ADD COLUMN reflection_note TEXT NULL;

-- 周报主表（结构化评分 + 洞察）
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
  report_data JSON NULL,
  error_message VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_wr_user_week (user_id, week_start),
  KEY idx_wr_user_status (user_id, status),
  KEY idx_wr_user_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 兼容已存在 weekly_reports 的历史库（缺列则补齐）
ALTER TABLE weekly_reports ADD COLUMN health_score DECIMAL(5,2) NULL;
ALTER TABLE weekly_reports ADD COLUMN work_score DECIMAL(5,2) NULL;
ALTER TABLE weekly_reports ADD COLUMN play_score DECIMAL(5,2) NULL;
ALTER TABLE weekly_reports ADD COLUMN love_score DECIMAL(5,2) NULL;
ALTER TABLE weekly_reports ADD COLUMN energy_score DECIMAL(5,2) NULL;
ALTER TABLE weekly_reports ADD COLUMN balance_score DECIMAL(5,2) NULL;
ALTER TABLE weekly_reports ADD COLUMN coherence_score DECIMAL(5,2) NULL;
ALTER TABLE weekly_reports ADD COLUMN top_positive_behaviors JSON NULL;
ALTER TABLE weekly_reports ADD COLUMN top_negative_behaviors JSON NULL;
ALTER TABLE weekly_reports ADD COLUMN weekly_summary TEXT NULL;
ALTER TABLE weekly_reports ADD COLUMN weekly_insight TEXT NULL;
ALTER TABLE weekly_reports ADD COLUMN prototype_suggestions JSON NULL;
ALTER TABLE weekly_reports ADD COLUMN radar_data JSON NULL;
ALTER TABLE weekly_reports ADD COLUMN chart_data JSON NULL;
ALTER TABLE weekly_reports ADD COLUMN ai_status ENUM('generating','completed','failed','local_rule_generated') NOT NULL DEFAULT 'local_rule_generated';
ALTER TABLE weekly_reports ADD COLUMN prompt_version VARCHAR(32) NULL;
ALTER TABLE weekly_reports ADD COLUMN model_version VARCHAR(64) NULL;
ALTER TABLE weekly_reports ADD COLUMN rule_version VARCHAR(32) NULL;

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
