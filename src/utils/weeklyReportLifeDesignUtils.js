/**
 * 《设计你的人生》周报分析引擎（V1）
 * - 聚合 todo 行为字段 + AI 标签
 * - 输出周报结构化分值、洞察与建议
 */
import {
  PREDICAMENT_RULES,
  SECONDARY_DIMENSION_RULES
} from "../config/lifeDesignWeeklyRules.js";

const LIFE_DIMENSIONS = ["健康", "工作", "玩乐", "爱"];

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, round1(v)));
}

function truncateText(text, maxLen = 80) {
  const s = String(text || "").trim();
  if (!s) return "";
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}

function countKeywordMatches(text, keywords) {
  if (!text || !Array.isArray(keywords) || keywords.length === 0) return 0;
  let total = 0;
  for (const kw of keywords) {
    if (!kw) continue;
    const regex = new RegExp(String(kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = text.match(regex);
    if (matches) total += matches.length;
  }
  return total;
}

function safeJsonParse(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDimension(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (!v) return null;
  if (["health", "健康"].includes(v)) return "健康";
  if (["work", "工作"].includes(v)) return "工作";
  if (["play", "interest", "玩乐", "兴趣"].includes(v)) return "玩乐";
  if (["love", "爱"].includes(v)) return "爱";
  return LIFE_DIMENSIONS.includes(v) ? v : null;
}

function normalizeTodos(rows) {
  return rows.map((row) => {
    const aiTags = safeJsonParse(row.ai_tags);
    const durationCandidate =
      aiTags?.duration ??
      aiTags?.duration_hours ??
      aiTags?.durationHours ??
      aiTags?.duration_minutes ??
      aiTags?.durationMinutes ??
      null;
    let durationHours = Number(durationCandidate);
    if (!Number.isFinite(durationHours)) durationHours = 1;
    if (durationHours > 0 && durationHours > 24) durationHours = durationHours / 60;
    if (durationHours <= 0) durationHours = 1;
    return {
      ...row,
      ai_tags_obj: aiTags,
      life_dimension_norm: normalizeDimension(row.life_dimension || aiTags?.life_dimension),
      behavior_type_norm: row.behavior_type || aiTags?.behavior_type || null,
      flow_state: aiTags?.flow_state === true,
      prototype_behavior: aiTags?.prototype_behavior === true,
      cognitive_tags: Array.isArray(aiTags?.cognitive_tags) ? aiTags.cognitive_tags : [],
      duration_hours: round2(durationHours)
    };
  });
}

function buildDimensionScores(todos) {
  const counts = { 健康: 0, 工作: 0, 玩乐: 0, 爱: 0 };
  for (const t of todos) {
    if (t.life_dimension_norm) counts[t.life_dimension_norm] += 1;
  }
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const scoreFromRatio = (ratio) => round1(Math.min(100, ratio * 100));
  if (total === 0) {
    return {
      health_score: 0,
      work_score: 0,
      play_score: 0,
      love_score: 0,
      counts
    };
  }

  return {
    health_score: scoreFromRatio(counts["健康"] / total),
    work_score: scoreFromRatio(counts["工作"] / total),
    play_score: scoreFromRatio(counts["玩乐"] / total),
    love_score: scoreFromRatio(counts["爱"] / total),
    counts
  };
}

function calcEnergyScore(todos) {
  const deltas = [];
  for (const t of todos) {
    if (Number.isFinite(t.energy_before) && Number.isFinite(t.energy_after)) {
      deltas.push(Number(t.energy_after) - Number(t.energy_before));
      continue;
    }
    const effect = String(t.ai_tags_obj?.energy_effect || "").toLowerCase();
    if (effect.includes("up") || effect.includes("增加") || effect.includes("提升")) deltas.push(1);
    if (effect.includes("down") || effect.includes("下降") || effect.includes("消耗")) deltas.push(-1);
  }
  if (deltas.length === 0) return 50;
  const avg = deltas.reduce((s, n) => s + n, 0) / deltas.length;
  return round1(Math.max(0, Math.min(100, 50 + avg * 16)));
}

function calcBalanceScore(dimensionCounts) {
  const values = Object.values(dimensionCounts);
  const total = values.reduce((s, n) => s + n, 0);
  if (total === 0) return 0;
  const target = total / 4;
  const meanAbsDeviation = values.reduce((s, n) => s + Math.abs(n - target), 0) / 4;
  const normalized = Math.max(0, 1 - meanAbsDeviation / Math.max(target, 1));
  return round1(normalized * 100);
}

function calcCoherenceScore(todos) {
  if (todos.length === 0) return 0;
  const activeChoiceCount = todos.filter((t) => t.is_active_choice === 1 || t.is_active_choice === true).length;
  const flowCount = todos.filter((t) => t.flow_state).length;
  const prototypeCount = todos.filter((t) => t.prototype_behavior).length;
  const activeRatio = activeChoiceCount / todos.length;
  const flowRatio = flowCount / todos.length;
  const prototypeRatio = prototypeCount / todos.length;
  return round1(Math.min(100, (activeRatio * 0.45 + flowRatio * 0.35 + prototypeRatio * 0.2) * 100));
}

function buildBehaviorExtremes(todos) {
  const positive = [];
  const negative = [];
  for (const t of todos) {
    const label = String(t.content || "").trim().slice(0, 40) || "(未命名行为)";
    const delta =
      Number.isFinite(t.energy_before) && Number.isFinite(t.energy_after)
        ? Number(t.energy_after) - Number(t.energy_before)
        : 0;
    const flow = t.flow_state;
    const engagement = Number(t.engagement_level || 0);
    const energyAfter = Number.isFinite(Number(t.energy_after)) ? Number(t.energy_after) : 5;
    const flowBonus = flow ? 3 : 0;
    const vitalityScore = clampScore((engagement * 10 + energyAfter * 8 + flowBonus * 6) * 1.2);
    if (delta > 0 || flow) {
      positive.push({
        behavior: label,
        title: label,
        life_dimension: t.life_dimension_norm,
        energy_delta: delta,
        flow_state: flow,
        vitality_score: vitalityScore,
        ai_explanation: delta > 0 ? "该事项完成后能量提升，属于高生命力行为。" : "该事项具备心流特征，建议持续投入。"
      });
    }
    if (delta < 0 || engagement <= 2 || String(t.emotion_after || "").includes("负")) {
      negative.push({
        behavior: label,
        title: label,
        life_dimension: t.life_dimension_norm,
        energy_delta: delta,
        engagement_level: t.engagement_level ?? null,
        drain_score: clampScore(60 + Math.max(0, -delta) * 12 + (engagement <= 2 ? 15 : 0)),
        reason:
          delta < 0
            ? "完成后能量下降"
            : engagement <= 2
              ? "投入度偏低"
              : "情绪反馈偏负面",
        reducible: delta < -1 || engagement <= 2
      });
    }
  }

  positive.sort((a, b) => b.vitality_score - a.vitality_score);
  negative.sort((a, b) => b.drain_score - a.drain_score);
  return {
    top_positive_behaviors: positive.slice(0, 3),
    top_negative_behaviors: negative.slice(0, 3)
  };
}

function countSecondaryDimensions(todos) {
  const counts = {};
  for (const rule of SECONDARY_DIMENSION_RULES) counts[rule.key] = 0;

  for (const todo of todos) {
    const sourceText = [
      todo.content,
      todo.reflection_note,
      todo.behavior_type_norm,
      ...(todo.cognitive_tags || [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const rule of SECONDARY_DIMENSION_RULES) {
      if (rule.key === "prototype_explore" && todo.prototype_behavior) {
        counts[rule.key] += 1;
        continue;
      }
      if (rule.key === "deep_work" && todo.flow_state) {
        counts[rule.key] += 1;
        continue;
      }
      if (rule.keywords.some((kw) => sourceText.includes(kw))) {
        counts[rule.key] += 1;
      }
    }
  }
  return counts;
}

function detectPredicaments(todos, secondaryCounts) {
  const notes = todos
    .map((t) => String(t.reflection_note || "").trim())
    .filter(Boolean);
  const joined = notes.join(" | ").toLowerCase();
  const lowEnergyCount = todos.filter(
    (t) =>
      (Number.isFinite(t.energy_before) && Number.isFinite(t.energy_after) && t.energy_after < t.energy_before) ||
      String(t.ai_tags_obj?.energy_effect || "").includes("下降")
  ).length;
  const lowEngagementCount = todos.filter((t) => Number(t.engagement_level || 0) > 0 && Number(t.engagement_level) <= 2).length;

  const gravityScore =
    countKeywordMatches(joined, PREDICAMENT_RULES.gravity.keywords) + (lowEnergyCount >= 4 ? 1 : 0);
  const anchoringScore = countKeywordMatches(joined, PREDICAMENT_RULES.anchoring.keywords);
  const actionScore =
    lowEngagementCount + countKeywordMatches(joined, PREDICAMENT_RULES.action.keywords);
  const energyScore = lowEnergyCount + (secondaryCounts.body_energy === 0 ? 1 : 0);
  const structureScore = countKeywordMatches(joined, PREDICAMENT_RULES.structure.keywords);

  return {
    gravity_problem: gravityScore >= PREDICAMENT_RULES.gravity.threshold,
    anchoring_problem: anchoringScore >= PREDICAMENT_RULES.anchoring.threshold,
    action_problem: actionScore >= PREDICAMENT_RULES.action.threshold,
    energy_problem: energyScore >= PREDICAMENT_RULES.energy.threshold,
    structure_problem: structureScore >= PREDICAMENT_RULES.structure.threshold,
    evidence: {
      low_energy_count: lowEnergyCount,
      low_engagement_count: lowEngagementCount,
      reflection_note_count: notes.length
    }
  };
}

function buildWeeklySummary(scores, secondaryCounts, predicaments) {
  const weakest = [
    { key: "健康", score: scores.health_score },
    { key: "工作", score: scores.work_score },
    { key: "玩乐", score: scores.play_score },
    { key: "爱", score: scores.love_score }
  ].sort((a, b) => a.score - b.score)[0];

  const predKeys = [];
  if (predicaments.gravity_problem) predKeys.push("重力问题");
  if (predicaments.anchoring_problem) predKeys.push("锚定问题");
  if (predicaments.action_problem) predKeys.push("行动问题");
  if (predicaments.energy_problem) predKeys.push("能量问题");
  if (predicaments.structure_problem) predKeys.push("结构问题");

  const hasPredicament = predKeys.length > 0;
  const mainProblem = hasPredicament ? predKeys[0] : `${weakest.key}维度投入不足`;
  const mainDirection = hasPredicament ? "先拆解阻碍，再从最小行动启动" : `继续放大${weakest.key}之外的稳定高能行为`;
  const mainInsight = truncateText(
    hasPredicament
      ? `本周主导困境是「${mainProblem}」，优先用低阻力小步骤恢复节奏。`
      : `本周整体可持续，建议围绕「${weakest.key}」补齐最小投入形成平衡。`,
    80
  );
  return {
    weekly_summary: `本周生活结构最弱维度为「${weakest.key}」，平衡分 ${scores.balance_score}，一致性分 ${scores.coherence_score}。`,
    weekly_insight: mainInsight,
    main_insight: mainInsight,
    main_problem: mainProblem,
    main_direction: mainDirection,
    problem_type: mainProblem,
    problem_summary: hasPredicament
      ? `检测到${predKeys.join("、")}迹象，建议先减少阻力，再建立稳定行动回路。`
      : `当前未出现明显结构性困境，但「${weakest.key}」维度需要补能。`,
    prototype_suggestions: buildPrototypeSuggestions(secondaryCounts, weakest.key)
  };
}

function buildPrototypeSuggestions(secondaryCounts, weakestDimension) {
  const suggestions = [];
  if (weakestDimension === "健康") suggestions.push("下周做一个 15 分钟运动原型：连续 3 天完成即可。");
  if (weakestDimension === "工作") suggestions.push("下周做一个深度工作原型：每天固定 25 分钟无打断输出。");
  if (weakestDimension === "玩乐") suggestions.push("下周做一个非功利玩乐原型：安排 2 次纯兴趣活动。");
  if (weakestDimension === "爱") suggestions.push("下周做一个连接原型：主动发起 2 次高质量对话。");
  if (secondaryCounts.prototype_explore === 0) {
    suggestions.push("新增 1 个人生原型探索：尝试一个你从未做过的小行动并记录感受。");
  }
  return suggestions.slice(0, 5);
}

function buildRadarData(todos, secondaryCounts) {
  const total = Math.max(todos.length, 1);
  const keyScore = (key) => clampScore(((secondaryCounts[key] || 0) / total) * 100);
  return [
    { name: "身体能量", score: keyScore("body_energy") },
    { name: "情绪恢复", score: keyScore("emotion_recovery") },
    { name: "深度工作", score: keyScore("deep_work") },
    { name: "创造表达", score: keyScore("creative_expression") },
    { name: "信息输入", score: keyScore("info_input") },
    { name: "社交连接", score: keyScore("social_connection") },
    { name: "玩乐滋养", score: keyScore("play_nourishment") },
    { name: "人生原型探索", score: keyScore("prototype_explore") }
  ];
}

function buildChartData(todos, dimensionCounts, secondaryCounts) {
  const hours = { health_hours: 0, work_hours: 0, play_hours: 0, love_hours: 0 };
  for (const todo of todos) {
    const h = Number(todo.duration_hours || 0);
    if (!Number.isFinite(h)) continue;
    if (todo.life_dimension_norm === "健康") hours.health_hours += h;
    if (todo.life_dimension_norm === "工作") hours.work_hours += h;
    if (todo.life_dimension_norm === "玩乐") hours.play_hours += h;
    if (todo.life_dimension_norm === "爱") hours.love_hours += h;
  }
  for (const k of Object.keys(hours)) hours[k] = round2(hours[k]);
  return {
    ...hours,
    total_hours: round2(hours.health_hours + hours.work_hours + hours.play_hours + hours.love_hours),
    dimension_distribution: Object.entries(dimensionCounts).map(([name, count]) => ({
      name,
      count
    })),
    secondary_distribution: Object.entries(secondaryCounts).map(([key, count]) => ({
      key,
      count
    }))
  };
}

function buildQuadrantDashboard(todos, scores) {
  const byDim = { 健康: [], 工作: [], 玩乐: [], 爱: [] };
  for (const todo of todos) {
    if (todo.life_dimension_norm && byDim[todo.life_dimension_norm]) {
      byDim[todo.life_dimension_norm].push(todo);
    }
  }
  const toEnergyStatus = (items) => {
    if (!items.length) return "中性";
    const deltas = items
      .map((t) =>
        Number.isFinite(t.energy_before) && Number.isFinite(t.energy_after)
          ? Number(t.energy_after) - Number(t.energy_before)
          : 0
      )
      .filter((v) => Number.isFinite(v));
    if (!deltas.length) return "中性";
    const avg = deltas.reduce((s, n) => s + n, 0) / deltas.length;
    if (avg >= 0.5) return "上升";
    if (avg <= -0.5) return "下降";
    return "平稳";
  };
  const buildOne = (zhName, score) => {
    const items = byDim[zhName];
    const duration = round2(items.reduce((s, t) => s + Number(t.duration_hours || 0), 0));
    return {
      score: clampScore(score),
      duration,
      energy_status: toEnergyStatus(items),
      summary: items.length > 0 ? `${zhName}维度完成 ${items.length} 项行为。` : `${zhName}维度暂无行为记录。`
    };
  };
  return {
    health: buildOne("健康", scores.health_score),
    work: buildOne("工作", scores.work_score),
    play: buildOne("玩乐", scores.play_score),
    love: buildOne("爱", scores.love_score)
  };
}

function buildReframing(problemType) {
  const isEnergy = String(problemType || "").includes("能量");
  if (isEnergy) {
    return {
      original_problem: "每天都很累，无法推进关键事项。",
      reframed_problem: "先恢复基础能量，再推进最小可执行任务。",
      small_action: "明天先做 20 分钟不被打断的单一任务。"
    };
  }
  return {
    original_problem: "目标太大导致持续拖延。",
    reframed_problem: "把目标改写为本周可完成的最小实验。",
    small_action: "本周仅完成 1 次 30 分钟的原型行动并记录复盘。"
  };
}

function buildPrototypeExperiments(weakDimension) {
  const map = {
    健康: { name: "晨间活力实验", goal: "连续 3 天晨间运动 15 分钟", period: "下周一到下周三" },
    工作: { name: "深度输出实验", goal: "每天完成 1 次 25 分钟深度工作", period: "下周工作日" },
    玩乐: { name: "兴趣滋养实验", goal: "安排 2 次无功利兴趣活动", period: "下周内" },
    爱: { name: "关系连接实验", goal: "完成 2 次高质量连接对话", period: "下周内" }
  };
  const base = map[weakDimension] || map.工作;
  return [base];
}

export async function fetchWeekTodos(pool, userId, weekStart, weekEnd) {
  const [rows] = await pool.query(
    `SELECT id, content, tag, due_at, completed, completed_at, created_at, updated_at, deleted_at,
            emotion_before, emotion_after, energy_before, energy_after, is_active_choice,
            engagement_level, completion_feeling, life_dimension, behavior_type, ai_tags, reflection_note
     FROM todos
     WHERE user_id = ?
       AND deleted_at IS NULL
       AND (
         (completed_at >= ? AND completed_at < DATE_ADD(?, INTERVAL 1 DAY))
         OR (updated_at >= ? AND updated_at < DATE_ADD(?, INTERVAL 1 DAY))
       )
     ORDER BY updated_at ASC, id ASC`,
    [userId, weekStart, weekEnd, weekStart, weekEnd]
  );
  return rows;
}

export async function generateReportData(pool, userId, weekStart, weekEnd) {
  const rawTodos = await fetchWeekTodos(pool, userId, weekStart, weekEnd);
  const todos = normalizeTodos(rawTodos);

  const dimensionScores = buildDimensionScores(todos);
  const energyScore = calcEnergyScore(todos);
  const balanceScore = calcBalanceScore(dimensionScores.counts);
  const coherenceScore = calcCoherenceScore(todos);
  const extremes = buildBehaviorExtremes(todos);
  const secondaryCounts = countSecondaryDimensions(todos);
  const predicaments = detectPredicaments(todos, secondaryCounts);

  const scores = {
    ...dimensionScores,
    energy_score: energyScore,
    balance_score: balanceScore,
    coherence_score: coherenceScore
  };

  const narrative = buildWeeklySummary(scores, secondaryCounts, predicaments);
  const radarData = buildRadarData(todos, secondaryCounts);
  const chartData = buildChartData(todos, dimensionScores.counts, secondaryCounts);
  const quadrantDashboard = buildQuadrantDashboard(todos, scores);
  const reframing = buildReframing(narrative.problem_type);
  const weakestDimension = [
    { key: "健康", score: scores.health_score },
    { key: "工作", score: scores.work_score },
    { key: "玩乐", score: scores.play_score },
    { key: "爱", score: scores.love_score }
  ].sort((a, b) => a.score - b.score)[0]?.key;
  const prototypeExperiments = buildPrototypeExperiments(weakestDimension);
  const behaviorDetails = todos.map((t) => ({
    id: String(t.id),
    title: String(t.content || "").trim() || "(未命名事项)",
    completed: !!t.completed,
    life_dimension: t.life_dimension_norm,
    ai_tag: t.behavior_type_norm || null,
    energy_change:
      Number.isFinite(t.energy_before) && Number.isFinite(t.energy_after)
        ? Number(t.energy_after) - Number(t.energy_before)
        : null,
    time_hours: t.duration_hours
  }));

  return {
    week_start: weekStart,
    week_end: weekEnd,
    generated_at: new Date().toISOString(),
    ai_status: "local_rule_generated",
    todo_count: todos.length,
    ...scores,
    secondary_dimensions: secondaryCounts,
    main_insight: narrative.main_insight,
    main_problem: narrative.main_problem,
    main_direction: narrative.main_direction,
    quadrant_dashboard: quadrantDashboard,
    top_positive_behaviors: extremes.top_positive_behaviors,
    top_negative_behaviors: extremes.top_negative_behaviors,
    predicament_insights: predicaments,
    problem_type: narrative.problem_type,
    problem_summary: narrative.problem_summary,
    reframing,
    weekly_summary: narrative.weekly_summary,
    weekly_insight: narrative.weekly_insight,
    prototype_experiments: prototypeExperiments,
    prototype_suggestions: narrative.prototype_suggestions,
    radar_data: radarData,
    chart_data: chartData,
    time_distribution: {
      health_hours: chartData.health_hours,
      work_hours: chartData.work_hours,
      play_hours: chartData.play_hours,
      love_hours: chartData.love_hours,
      total_hours: chartData.total_hours
    },
    behaviors: behaviorDetails
  };
}

export function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  };
}

export function getWeekRangeByOffset(offset = 0) {
  const { start } = getCurrentWeekRange();
  const monday = new Date(`${start}T00:00:00`);
  monday.setDate(monday.getDate() + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDate(monday),
    end: formatDate(sunday)
  };
}
