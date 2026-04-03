#!/usr/bin/env node
/**
 * 对比两个接口在 vision 场景下的 id+content 是否完全一致。
 *
 * 用法：
 * API_BASE_URL=https://your-domain.com \
 * API_TOKEN=xxxxx \
 * VISION_ID=51 \
 * node scripts/verify-vision-api-consistency.js
 */

function getEnv(name) {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

function normalizeBaseUrl(raw) {
  return raw.replace(/\/+$/, "");
}

function normalizeItem(item) {
  return {
    id: item?.id == null ? null : String(item.id),
    content: item?.content == null ? "" : String(item.content),
  };
}

function toComparableList(items) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeItem)
    .sort((a, b) => {
      if (a.id === b.id) return a.content.localeCompare(b.content, "zh-CN");
      return a.id.localeCompare(b.id, "en");
    });
}

function asKey(item) {
  return `${item.id}|||${item.content}`;
}

function diffByKey(left, right) {
  const rightSet = new Set(right.map(asKey));
  return left.filter((x) => !rightSet.has(asKey(x)));
}

async function getJson(url, token) {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function main() {
  const baseUrl = normalizeBaseUrl(getEnv("API_BASE_URL"));
  const token = getEnv("API_TOKEN");
  const visionId = getEnv("VISION_ID");

  if (!baseUrl || !token || !visionId) {
    console.error("缺少环境变量：API_BASE_URL、API_TOKEN、VISION_ID");
    process.exit(2);
  }

  const visionUrl = `${baseUrl}/api/vision/${encodeURIComponent(visionId)}/todos`;
  const todosUrl = `${baseUrl}/api/todos?vision_id=${encodeURIComponent(visionId)}`;

  const [visionRes, todosRes] = await Promise.all([
    getJson(visionUrl, token),
    getJson(todosUrl, token),
  ]);

  const visionItems = toComparableList(visionRes?.data?.items || []);
  const todosItems = toComparableList(todosRes?.items || []);

  const onlyInVision = diffByKey(visionItems, todosItems);
  const onlyInTodos = diffByKey(todosItems, visionItems);

  const sameLength = visionItems.length === todosItems.length;
  const fullyEqual = sameLength && onlyInVision.length === 0 && onlyInTodos.length === 0;

  console.log(
    JSON.stringify(
      {
        vision_id: String(visionId),
        equal: fullyEqual,
        vision_count: visionItems.length,
        todos_count: todosItems.length,
        only_in_vision_count: onlyInVision.length,
        only_in_todos_count: onlyInTodos.length,
      },
      null,
      2
    )
  );

  if (!fullyEqual) {
    console.log("\n仅在 /api/vision/:id/todos 中存在（最多 20 条）：");
    console.log(JSON.stringify(onlyInVision.slice(0, 20), null, 2));

    console.log("\n仅在 /api/todos?vision_id=... 中存在（最多 20 条）：");
    console.log(JSON.stringify(onlyInTodos.slice(0, 20), null, 2));

    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[verify-vision-api-consistency] 失败：", err?.message || err);
  process.exit(1);
});

