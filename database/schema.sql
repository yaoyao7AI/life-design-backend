-- Growth CMS foundation schema (Sprint B Step 1)
-- MySQL 8.0+

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  membership_type ENUM('free', 'founder') NOT NULL DEFAULT 'free',
  expire_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS topics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  icon_url VARCHAR(1024) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  article_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_topics_slug (slug),
  KEY idx_topics_status_sort (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS articles (
  id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  title_en VARCHAR(255) NULL,
  slug VARCHAR(255) NOT NULL,
  topic_id BIGINT UNSIGNED NULL,
  content JSON NOT NULL,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  visibility ENUM('public', 'members_only') NOT NULL DEFAULT 'public',
  membership_tier ENUM('free', 'founder') NOT NULL DEFAULT 'free',
  cover_url VARCHAR(1024) NULL,
  views BIGINT UNSIGNED NOT NULL DEFAULT 0,
  likes BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reading_time_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  author_id CHAR(36) NOT NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_articles_slug (slug),
  KEY idx_articles_topic_id (topic_id),
  KEY idx_articles_status_visibility (status, visibility),
  KEY idx_articles_published_at (published_at),
  KEY idx_articles_author_id (author_id),
  CONSTRAINT fk_articles_topic_id FOREIGN KEY (topic_id) REFERENCES topics(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_articles_author_id FOREIGN KEY (author_id) REFERENCES users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS membership_plans (
  id CHAR(36) NOT NULL,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  tier ENUM('free', 'founder') NOT NULL,
  billing_cycle VARCHAR(32) NOT NULL,
  price_cents INT UNSIGNED NOT NULL DEFAULT 0,
  original_price_cents INT UNSIGNED NULL,
  benefits JSON NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_membership_plans_code (code),
  KEY idx_membership_plans_tier_status (tier, status),
  KEY idx_membership_plans_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_membership (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  tier ENUM('free', 'founder') NOT NULL DEFAULT 'free',
  status ENUM('active', 'expired', 'canceled') NOT NULL DEFAULT 'active',
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,
  auto_renew TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_membership_user_id (user_id),
  KEY idx_user_membership_status_end_at (status, end_at),
  CONSTRAINT fk_user_membership_user_id FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uploads (
  id CHAR(36) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime VARCHAR(120) NOT NULL,
  size BIGINT UNSIGNED NOT NULL,
  width INT UNSIGNED NOT NULL DEFAULT 0,
  height INT UNSIGNED NOT NULL DEFAULT 0,
  storage_path VARCHAR(1024) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  created_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_uploads_created_by (created_by),
  KEY idx_uploads_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS home_banners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(120) NOT NULL,
  image_url VARCHAR(1024) NOT NULL,
  link_url VARCHAR(1024) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_home_banners_status_sort (status, sort_order),
  KEY idx_home_banners_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS home_courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(255) NULL,
  cover_url VARCHAR(1024) NOT NULL,
  link_url VARCHAR(1024) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_home_courses_status_sort (status, sort_order),
  KEY idx_home_courses_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS home_sections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section_key ENUM('most_popular', 'latest') NOT NULL,
  title VARCHAR(120) NOT NULL,
  subtitle VARCHAR(255) NULL,
  article_limit INT UNSIGNED NOT NULL DEFAULT 6,
  article_ids JSON NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_home_sections_section_key (section_key),
  KEY idx_home_sections_status_sort (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS membership_cta (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  subtitle VARCHAR(255) NULL,
  button_text VARCHAR(80) NOT NULL,
  button_link VARCHAR(1024) NULL,
  background_image_url VARCHAR(1024) NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO membership_plans (
  id, code, name, tier, billing_cycle, price_cents, original_price_cents,
  benefits, status, sort_order
)
VALUES
  (
    'plan_free',
    'FREE',
    'Free',
    'free',
    'lifetime',
    0,
    NULL,
    JSON_ARRAY('基础阅读权限', '基础愿景功能'),
    'active',
    1
  ),
  (
    'plan_founder',
    'FOUNDER',
    'Founder',
    'founder',
    'lifetime',
    9900,
    19900,
    JSON_ARRAY('会员文章', '无限愿景创建', '高级模板'),
    'active',
    2
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  tier = VALUES(tier),
  billing_cycle = VALUES(billing_cycle),
  price_cents = VALUES(price_cents),
  original_price_cents = VALUES(original_price_cents),
  benefits = VALUES(benefits),
  status = VALUES(status),
  sort_order = VALUES(sort_order);

INSERT INTO home_sections (
  section_key, title, subtitle, article_limit, status, sort_order
)
VALUES
  ('most_popular', 'Most Popular', '本周最受欢迎内容', 6, 'active', 1),
  ('latest', 'Latest', '最新发布内容', 6, 'active', 2)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  article_limit = VALUES(article_limit),
  status = VALUES(status),
  sort_order = VALUES(sort_order);

INSERT INTO membership_cta (
  id, title, subtitle, button_text, button_link, background_image_url, status
)
VALUES
  (
    1,
    '升级 Founder，解锁完整成长体系',
    '获取会员文章、无限愿景创建与高级模板能力',
    '立即升级',
    '/membership',
    NULL,
    'active'
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  button_text = VALUES(button_text),
  button_link = VALUES(button_link),
  background_image_url = VALUES(background_image_url),
  status = VALUES(status);