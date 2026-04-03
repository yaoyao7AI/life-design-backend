import dotenv from "dotenv";
import { pool } from "../src/db.js";
import {
  ensureTodosVisionColumns,
  unifiedTodoIdFromVisionBoardTodoId,
  visionBoardTitleContentToTodoContent
} from "../src/utils/visionUnifiedTodoSync.js";
import { normalizeTodoTag } from "../src/utils/syncUtils.js";

dotenv.config();

const BATCH_SIZE = Number(process.env.BACKFILL_BATCH_SIZE || 500);

async function runBackfill() {
  await ensureTodosVisionColumns(pool);

  let lastId = 0;
  let scanned = 0;
  let insertedOrUpdated = 0;

  while (true) {
    const [rows] = await pool.query(
      `
        SELECT id, user_id, vision_board_id, title, content, tag, occur_at, created_at, updated_at, deleted_at
        FROM vision_board_todos
        WHERE id > ?
        ORDER BY id ASC
        LIMIT ?
      `,
      [lastId, BATCH_SIZE]
    );

    if (!rows.length) break;

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      for (const row of rows) {
        const todoId = unifiedTodoIdFromVisionBoardTodoId(row.id);
        const content = visionBoardTitleContentToTodoContent(row.title, row.content);
        const tag = normalizeTodoTag(row.tag);
        const dueAt = row.occur_at || null;
        const createdAt = row.created_at || row.updated_at || new Date();
        const updatedAt = row.updated_at || createdAt;
        const deletedAt = row.deleted_at || null;
        const visionId = Number(row.vision_board_id);

        await conn.query(
          `
            INSERT INTO todos
              (user_id, id, content, tag, due_at, completed, completed_at,
               created_at, updated_at, deleted_at, client_id, last_request_id, rev, source, vision_id)
            VALUES
              (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, NULL, NULL, 1, 'vision', ?)
            ON DUPLICATE KEY UPDATE
              content = VALUES(content),
              tag = VALUES(tag),
              due_at = VALUES(due_at),
              created_at = VALUES(created_at),
              updated_at = VALUES(updated_at),
              deleted_at = VALUES(deleted_at),
              source = 'vision',
              vision_id = VALUES(vision_id),
              rev = IF(
                NOT (
                  content <=> VALUES(content)
                  AND tag <=> VALUES(tag)
                  AND due_at <=> VALUES(due_at)
                  AND created_at <=> VALUES(created_at)
                  AND updated_at <=> VALUES(updated_at)
                  AND deleted_at <=> VALUES(deleted_at)
                  AND source <=> 'vision'
                  AND vision_id <=> VALUES(vision_id)
                ),
                rev + 1,
                rev
              )
          `,
          [row.user_id, todoId, content, tag, dueAt, createdAt, updatedAt, deletedAt, visionId]
        );
        insertedOrUpdated += 1;
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    scanned += rows.length;
    lastId = rows[rows.length - 1].id;
    console.log(
      `[VISION_BACKFILL] batch_done scanned=${scanned} upserted=${insertedOrUpdated} last_id=${lastId}`
    );
  }

  console.log(
    `[VISION_BACKFILL] done scanned=${scanned} upserted=${insertedOrUpdated} batch_size=${BATCH_SIZE}`
  );
}

runBackfill()
  .catch((err) => {
    console.error("[VISION_BACKFILL] failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {}
  });
