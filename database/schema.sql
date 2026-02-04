-- life_design — 全套建表 SQL
-- 请在阿里云 RDS → 数据管理（DMS）→ SQL 控制台执行

-- 切换到数据库
USE life_design;

-- ================
-- 1. 用户表 users
-- ================
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(20) UNIQUE NOT NULL,
    nickname VARCHAR(50),
    avatar VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================
-- 2. 肯定语表 affirmations
-- ==========================
CREATE TABLE IF NOT EXISTS affirmations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(20) UNIQUE NOT NULL,
    text TEXT NOT NULL,
    category VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================
-- 3. 收藏表 favorites
-- =====================
CREATE TABLE IF NOT EXISTS favorites (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    affirmation_id INT NOT NULL,
    category VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (affirmation_id) REFERENCES affirmations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =========================
-- 4. 愿景板主表 vision_boards
-- =========================
CREATE TABLE IF NOT EXISTS vision_boards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    name VARCHAR(100),
    quadrant VARCHAR(20), -- 健康/工作/爱/兴趣
    thumbnail VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================
-- 5. 愿景板元素 vision_elements
-- ==========================
CREATE TABLE IF NOT EXISTS vision_elements (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    board_id BIGINT NOT NULL,
    type ENUM('text', 'image') NOT NULL,
    content TEXT,
    x FLOAT DEFAULT 0,
    y FLOAT DEFAULT 0,
    width FLOAT,
    height FLOAT,
    rotation FLOAT DEFAULT 0,
    font_size INT,
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES vision_boards(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ======================
-- 6. 练习记录 practice_logs
-- ======================
CREATE TABLE IF NOT EXISTS practice_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    board_id BIGINT NOT NULL,
    practice_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (board_id) REFERENCES vision_boards(id),
    UNIQUE (user_id, board_id, practice_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ======================
-- 7. 短信验证码 sms_codes（可选，用于之后替换 Supabase OTP）
-- ======================
CREATE TABLE IF NOT EXISTS sms_codes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(10) NOT NULL,
    expired_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



