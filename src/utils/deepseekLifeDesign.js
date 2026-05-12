const DEFAULT_DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";

function sanitizeText(v, maxLength = 2000) {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, maxLength);
}

function safeParseJson(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function pickJsonFromContent(content) {
  if (!content || typeof content !== "string") return null;
  const direct = safeParseJson(content);
  if (direct) return direct;

  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return safeParseJson(content.slice(firstBrace, lastBrace + 1));
  }
  return null;
}

function boolOrNull(v) {
  if (v === true || v === false) return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return null;
}

function normalizeAiTags(raw, fallback = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const output = {
    life_dimension: sanitizeText(raw.life_dimension || fallback.life_dimension, 20) || null,
    behavior_type: sanitizeText(raw.behavior_type || fallback.behavior_type, 20) || null,
    energy_effect: sanitizeText(raw.energy_effect, 32) || null,
    long_term_value: sanitizeText(raw.long_term_value, 64) || null,
    flow_state: boolOrNull(raw.flow_state),
    prototype_behavior: boolOrNull(raw.prototype_behavior),
    emotion_effect: sanitizeText(raw.emotion_effect, 64) || null,
    cognitive_tags: Array.isArray(raw.cognitive_tags)
      ? raw.cognitive_tags.map((item) => sanitizeText(item, 40)).filter(Boolean).slice(0, 20)
      : []
  };

  return output;
}

function buildMessages(payload) {
  const sample = {
    title: sanitizeText(payload.title, 200),
    duration: Number.isFinite(Number(payload.duration)) ? Number(payload.duration) : null,
    emotion_after: sanitizeText(payload.emotion_after, 32) || null,
    engagement_level: Number.isFinite(Number(payload.engagement_level))
      ? Number(payload.engagement_level)
      : null,
    reflection_note: sanitizeText(payload.reflection_note, 500) || null
  };

  return [
    {
      role: "system",
      content:
        "你是人生行为分析AI。请根据用户行为完成结构化分析。只输出 JSON，不要输出解释。"
    },
    {
      role: "user",
      content: [
        "请根据用户行为：",
        "1. 判断所属人生维度",
        "2. 判断行为类型",
        "3. 判断能量变化",
        "4. 判断长期价值",
        "5. 判断是否属于心流行为",
        "6. 判断是否是人生原型探索",
        "7. 输出结构化JSON",
        "",
        "可选人生维度：健康 / 工作 / 玩乐 / 爱",
        "可选行为类型：输入 / 输出 / 恢复 / 连接 / 探索 / 维护",
        "",
        "返回 JSON：",
        `{
  "life_dimension":"",
  "behavior_type":"",
  "energy_effect":"",
  "long_term_value":"",
  "flow_state":true,
  "prototype_behavior":false,
  "emotion_effect":"",
  "cognitive_tags":[]
}`,
        "",
        "用户行为数据：",
        JSON.stringify(sample)
      ].join("\n")
    }
  ];
}

export function deepseekEnabled() {
  return !!process.env.DEEPSEEK_API_KEY;
}

export async function analyzeTodoWithDeepSeek(payload) {
  if (!deepseekEnabled()) return null;

  const endpoint = process.env.DEEPSEEK_API_URL || DEFAULT_DEEPSEEK_URL;
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;
  const timeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS || 12000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: buildMessages(payload)
      }),
      signal: controller.signal
    });

    if (!resp.ok) {
      const bodyText = await resp.text();
      throw new Error(`DeepSeek 请求失败: ${resp.status} ${bodyText.slice(0, 300)}`);
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    const parsed = pickJsonFromContent(content);
    return normalizeAiTags(parsed, payload);
  } finally {
    clearTimeout(timer);
  }
}
