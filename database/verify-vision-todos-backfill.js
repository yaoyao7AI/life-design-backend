import dotenv from "dotenv";
import { pool } from "../src/db.js";
import { ensureTodosVisionColumns } from "../src/utils/visionUnifiedTodoSync.js";

dotenv.config();

async function verifyVisionTodoBackfill() {
  await ensureTodosVisionColumns(pool);

  const [[vbtCountRow]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM vision_board_todos"
  );
  const [[todosVisionCountRow]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM todos WHERE source = 'vision'"
  );

  const [missingRows] = await pool.query(
    `
      SELECT vbt.id
      FROM vision_board_todos vbt
      LEFT JOIN todos t
        ON t.user_id = vbt.user_id
       AND t.id = CONCAT('vbt_', vbt.id)
      WHERE t.id IS NULL
      ORDER BY vbt.id ASC
    `
  );

  const [extraRows] = await pool.query(
    `
      SELECT t.id
      FROM todos t
      LEFT JOIN vision_board_todos vbt
        ON vbt.user_id = t.user_id
       AND t.id = CONCAT('vbt_', vbt.id)
      WHERE t.source = 'vision'
        AND vbt.id IS NULL
      ORDER BY t.id ASC
    `
  );

  const result = {
    total_vbt_count: Number(vbtCountRow?.cnt || 0),
    total_todos_vision_count: Number(todosVisionCountRow?.cnt || 0),
    missing_ids: missingRows.map((r) => Number(r.id)),
    extra_ids: extraRows.map((r) => String(r.id))
  };

  console.log(JSON.stringify(result, null, 2));

  const ok =
    result.total_vbt_count === result.total_todos_vision_count &&
    result.missing_ids.length === 0 &&
    result.extra_ids.length === 0;

  if (!ok) {
    process.exitCode = 1;
  }
}

verifyVisionTodoBackfill()
  .catch((err) => {
    console.error("[VISION_BACKFILL_VERIFY] failed:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch {}
  });
