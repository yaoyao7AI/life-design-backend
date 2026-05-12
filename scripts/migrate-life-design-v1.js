import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function splitSqlStatements(sqlText) {
  return sqlText
    .split(/;\s*(?:\r?\n|$)/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isIgnorableAlterError(err) {
  const message = String(err?.message || "");
  return (
    err?.code === "ER_DUP_FIELDNAME" ||
    message.includes("Duplicate column name") ||
    message.includes("already exists")
  );
}

async function run() {
  const migrationFile = path.resolve(__dirname, "../database/add-life-design-weekly-report-v1.sql");
  const sqlText = fs.readFileSync(migrationFile, "utf8");
  const statements = splitSqlStatements(sqlText);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || "life_design",
    connectTimeout: 30000
  });

  let executed = 0;
  try {
    for (const statement of statements) {
      try {
        await connection.query(statement);
        executed += 1;
      } catch (err) {
        if (isIgnorableAlterError(err)) continue;
        throw err;
      }
    }
    console.log(
      `[MIGRATE_LIFE_DESIGN_V1] done, executed=${executed}, totalStatements=${statements.length}`
    );
  } finally {
    await connection.end();
  }
}

run().catch((err) => {
  console.error("[MIGRATE_LIFE_DESIGN_V1] failed", err?.code, err?.message);
  process.exit(1);
});
