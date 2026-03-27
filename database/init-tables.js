import { db } from "../db.js";
import dotenv from "dotenv";

dotenv.config();

// 所有建表 SQL 语句
const createTableStatements = [
  {
    name: "users",
    sql: `CREATE TABLE IF NOT EXISTS users (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      phone VARCHAR(20) UNIQUE NOT NULL,
      nickname VARCHAR(50),
      avatar VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: "affirmations",
    sql: `CREATE TABLE IF NOT EXISTS affirmations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      code VARCHAR(20) UNIQUE NOT NULL,
      text TEXT NOT NULL,
      category VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: "favorites",
    sql: `CREATE TABLE IF NOT EXISTS favorites (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      affirmation_id INT NOT NULL,
      category VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (affirmation_id) REFERENCES affirmations(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: "vision_boards",
    sql: `CREATE TABLE IF NOT EXISTS vision_boards (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      name VARCHAR(100),
      quadrant VARCHAR(20),
      thumbnail VARCHAR(255),
      background_color VARCHAR(32),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: "vision_elements",
    sql: `CREATE TABLE IF NOT EXISTS vision_elements (
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
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: "practice_logs",
    sql: `CREATE TABLE IF NOT EXISTS practice_logs (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      board_id BIGINT NOT NULL,
      practice_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (board_id) REFERENCES vision_boards(id),
      UNIQUE (user_id, board_id, practice_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: "vision_board_todos",
    sql: `CREATE TABLE IF NOT EXISTS vision_board_todos (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      user_id BIGINT NOT NULL,
      vision_board_id BIGINT NOT NULL,
      title VARCHAR(200),
      content TEXT,
      image_url VARCHAR(1024),
      tag VARCHAR(20),
      occur_at DATETIME(3),
      sort_order INT NOT NULL DEFAULT 0,
      linked_todo_id VARCHAR(64),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      deleted_at DATETIME(3),
      KEY idx_vbt_user_board (user_id, vision_board_id),
      KEY idx_vbt_user_board_del_sort (user_id, vision_board_id, deleted_at, sort_order),
      KEY idx_vbt_user_linked (user_id, linked_todo_id),
      KEY idx_vbt_user_updated (user_id, updated_at, id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (vision_board_id) REFERENCES vision_boards(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
  {
    name: "sms_codes",
    sql: `CREATE TABLE IF NOT EXISTS sms_codes (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      phone VARCHAR(20) NOT NULL,
      code VARCHAR(10) NOT NULL,
      expired_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (phone)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  },
];

async function initTables() {
  try {
    console.log("开始创建数据表...\n");

    for (const table of createTableStatements) {
      try {
        await db.query(table.sql);
        console.log(`✅ ${table.name} 表创建成功`);
      } catch (err) {
        if (err.code === "ER_TABLE_EXISTS_ERROR" || err.message.includes("already exists")) {
          console.log(`⚠️  ${table.name} 表已存在，跳过`);
        } else {
          console.error(`❌ ${table.name} 表创建失败:`, err.message);
          throw err;
        }
      }
    }

    console.log("\n✅ 所有数据表创建完成！");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ 建表过程出错:", err.message);
    console.error(err);
    process.exit(1);
  }
}

initTables();
