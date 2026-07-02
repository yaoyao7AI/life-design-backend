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
  membership_tier ENUM('free', 'plus', 'pro') NOT NULL DEFAULT 'free',
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
  tier ENUM('free', 'plus', 'pro') NOT NULL,
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
  tier ENUM('free', 'plus', 'pro') NOT NULL DEFAULT 'free',
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