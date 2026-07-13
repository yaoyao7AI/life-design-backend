import { pool } from "../db/index.js";

function log(...args: unknown[]) {
  console.log("[GROWTH_SCHEMA]", ...args);
}

function autoMigrateEnabled() {
  const value = String(process.env.AUTO_MIGRATE_GROWTH_SCHEMA || "1")
    .trim()
    .toLowerCase();
  return !["0", "false", "off", "no"].includes(value);
}

export async function ensureGrowthSchema() {
  if (!autoMigrateEnabled()) return;

  try {
    await pool.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
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
        author_id VARCHAR(64) NOT NULL,
        published_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_articles_slug (slug),
        KEY idx_articles_topic_id (topic_id),
        KEY idx_articles_status_visibility (status, visibility),
        KEY idx_articles_published_at (published_at),
        KEY idx_articles_author_id (author_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_membership (
        id CHAR(36) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        tier ENUM('free', 'founder') NOT NULL DEFAULT 'free',
        status ENUM('active', 'expired', 'canceled') NOT NULL DEFAULT 'active',
        start_at DATETIME NOT NULL,
        end_at DATETIME NULL,
        auto_renew TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_user_membership_user_id (user_id),
        KEY idx_user_membership_status_end_at (status, end_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
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
        created_by VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_uploads_created_by (created_by),
        KEY idx_uploads_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
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
        KEY idx_home_banners_status_sort (status, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
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
        KEY idx_home_courses_status_sort (status, sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    try {
      const [cols] = await pool.query<any[]>(
        `
        SELECT COLUMN_NAME AS name
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'home_sections'
          AND COLUMN_NAME = 'article_ids'
        `
      );
      if (!Array.isArray(cols) || cols.length === 0) {
        await pool.query(
          `ALTER TABLE home_sections ADD COLUMN article_ids JSON NULL AFTER article_limit`
        );
        log("✅ home_sections.article_ids 已补齐");
      }
    } catch (error: any) {
      log("⚠️ 补齐 home_sections.article_ids 失败:", error?.code, error?.message);
    }

    await pool.query(`
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    log("✅ Growth CMS 核心表已就绪");
  } catch (error: any) {
    log("❌ Growth CMS 自动建表失败（不阻塞启动）:", error?.code, error?.message);
  }
}

