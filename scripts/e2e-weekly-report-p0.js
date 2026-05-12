/**
 * P0 联调回归脚本（自动清理测试数据）
 *
 * 用法：
 *   E2E_BASE_URL=http://127.0.0.1:3000 npm run e2e:weekly-report:p0
 *
 * 可选环境变量：
 * - E2E_BASE_URL: 默认 http://127.0.0.1:3000
 * - E2E_USER_ID:  默认 1
 * - E2E_WAIT_SECONDS: 轮询周报完成最大秒数，默认 20
 */
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { pool } from "../src/db.js";

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function buildToken() {
  const userId = Number(process.env.E2E_USER_ID || 1);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("E2E_USER_ID 非法");
  }
  const [rows] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!rows.length) {
    throw new Error(`用户不存在：${userId}`);
  }
  const secret = requireEnv("JWT_SECRET");
  const token = jwt.sign({ id: userId }, secret, { expiresIn: "1h" });
  return { userId, token };
}

async function request(baseUrl, token, method, path, body) {
  const resp = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: resp.status, json, text };
}

async function run() {
  const baseUrl = String(process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
  const waitSeconds = Number(process.env.E2E_WAIT_SECONDS || 20);
  const maxPoll = Number.isFinite(waitSeconds) && waitSeconds > 0 ? Math.floor(waitSeconds) : 20;
  const { userId, token } = await buildToken();

  const suffix = Date.now().toString().slice(-6);
  const boardTitle = `E2E愿景板-${suffix}`;
  const todoTitle = `E2E待办-${suffix}`;
  const reflectionNote = "E2E自动联调：完成后有能量";

  let boardId = null;
  let todoId = null;
  const result = {
    ok: false,
    user_id: userId,
    base_url: baseUrl,
    steps: {},
    assertions: {},
    errors: []
  };

  try {
    const createBoard = await request(baseUrl, token, "POST", "/api/vision", {
      title: boardTitle,
      quadrant: "工作"
    });
    result.steps.create_board = { status: createBoard.status };
    if (createBoard.status >= 400) throw new Error(`create_board_failed:${createBoard.status}`);
    boardId = String(createBoard.json?.data?.id ?? createBoard.json?.id ?? "");
    if (!boardId) throw new Error("create_board_missing_id");

    const createTodo = await request(baseUrl, token, "POST", "/api/todos", {
      content: todoTitle,
      vision_board_id: boardId
    });
    result.steps.create_todo = { status: createTodo.status };
    if (createTodo.status >= 400) throw new Error(`create_todo_failed:${createTodo.status}`);
    todoId = String(createTodo.json?.todo?.id ?? createTodo.json?.id ?? "");
    if (!todoId) throw new Error("create_todo_missing_id");

    const completeTodo = await request(
      baseUrl,
      token,
      "PATCH",
      `/api/todos/${encodeURIComponent(todoId)}/complete`,
      {
        completed: true,
        energy_feedback: "positive",
        meaning_feedback: "high",
        reflection_note: reflectionNote
      }
    );
    result.steps.complete_todo = { status: completeTodo.status };
    if (completeTodo.status >= 400) throw new Error(`complete_todo_failed:${completeTodo.status}`);

    const generate = await request(baseUrl, token, "POST", "/api/weekly-reports/generate", {
      week_offset: 0
    });
    result.steps.generate_report = { status: generate.status };
    if (generate.status >= 400) throw new Error(`generate_report_failed:${generate.status}`);

    let current = null;
    for (let i = 0; i < maxPoll; i += 1) {
      current = await request(baseUrl, token, "GET", "/api/weekly-reports/current");
      const status = current.json?.data?.status;
      const aiStatus = current.json?.data?.ai_status;
      if (status === "completed" && (aiStatus === "completed" || aiStatus === "local_rule_generated")) {
        result.steps.poll_completed_after = i + 1;
        break;
      }
      await sleep(1000);
    }

    result.steps.get_current = { status: current?.status ?? null };
    if (!current || current.status >= 400) throw new Error("get_current_failed");

    const report = current.json?.data?.report_data || null;
    const visionAlignment = report?.vision_alignment || null;
    const topPositive = Array.isArray(report?.top_positive_behaviors)
      ? report.top_positive_behaviors
      : [];
    const topNegative = Array.isArray(report?.top_negative_behaviors)
      ? report.top_negative_behaviors
      : [];

    result.assertions = {
      has_vision_alignment: !!(
        visionAlignment &&
        Array.isArray(visionAlignment.aligned_visions) &&
        Array.isArray(visionAlignment.deviated_visions)
      ),
      has_feedback_in_top_positive: topPositive.some(
        (item) => item?.energy_feedback || item?.meaning_feedback
      ),
      has_feedback_in_top_negative: topNegative.some(
        (item) => item?.energy_feedback || item?.meaning_feedback
      ),
      has_todo_in_top_positive: topPositive.some((item) =>
        String(item?.title || "").includes(todoTitle)
      ),
      has_reframe_suggestion: !!report?.reframe_suggestion,
      aligned_count: visionAlignment?.aligned_visions?.length ?? 0,
      report_status: current.json?.data?.status ?? null,
      report_ai_status: current.json?.data?.ai_status ?? null
    };

    result.ok = [
      result.assertions.has_vision_alignment,
      result.assertions.has_feedback_in_top_positive,
      result.assertions.has_feedback_in_top_negative,
      result.assertions.has_todo_in_top_positive,
      result.assertions.has_reframe_suggestion
    ].every(Boolean);
  } catch (err) {
    result.errors.push(String(err?.message || err));
  } finally {
    if (todoId) {
      const resp = await request(baseUrl, token, "DELETE", `/api/todos/${encodeURIComponent(todoId)}`);
      result.steps.cleanup_todo = { status: resp.status };
    }
    if (boardId) {
      const resp = await request(baseUrl, token, "DELETE", `/api/vision/${encodeURIComponent(boardId)}`);
      result.steps.cleanup_board = { status: resp.status };
    }
    console.log(JSON.stringify(result, null, 2));
    await pool.end();
    if (!result.ok) process.exit(2);
  }
}

run().catch(async (err) => {
  console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
