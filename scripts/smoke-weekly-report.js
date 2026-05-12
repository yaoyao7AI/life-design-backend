/**
 * 需要环境变量：
 * - SMOKE_BASE_URL: 例如 https://api.life-design.me
 * - SMOKE_TOKEN:    Bearer token
 */
import dotenv from "dotenv";

dotenv.config();

const baseUrl = (process.env.SMOKE_BASE_URL || "").trim().replace(/\/+$/, "");
const token = (process.env.SMOKE_TOKEN || "").trim();

if (!baseUrl || !token) {
  console.error("缺少 SMOKE_BASE_URL 或 SMOKE_TOKEN");
  process.exit(1);
}

async function request(method, pathname, body) {
  const resp = await fetch(`${baseUrl}${pathname}`, {
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
  } catch {}
  return { status: resp.status, json, text };
}

async function run() {
  console.log("[SMOKE] 1/3 POST /api/todos/ai/analyze");
  const ai = await request("POST", "/api/todos/ai/analyze", {
    title: "完成人生设计周报",
    duration: 90,
    emotion_after: "满足",
    engagement_level: 5,
    reflection_note: "专注投入，产出清晰"
  });
  console.log("[SMOKE] status:", ai.status);

  console.log("[SMOKE] 2/3 POST /api/weekly-reports/generate");
  const gen = await request("POST", "/api/weekly-reports/generate", { week_offset: 0 });
  console.log("[SMOKE] status:", gen.status, "payload:", JSON.stringify(gen.json));

  console.log("[SMOKE] 3/3 GET /api/weekly-reports/current");
  const current = await request("GET", "/api/weekly-reports/current");
  console.log("[SMOKE] status:", current.status);
  console.log("[SMOKE] data:", JSON.stringify(current.json));

  if (ai.status >= 400 || gen.status >= 400 || current.status >= 400) {
    process.exit(2);
  }
}

run().catch((err) => {
  console.error("[SMOKE] failed", err?.message || err);
  process.exit(1);
});
