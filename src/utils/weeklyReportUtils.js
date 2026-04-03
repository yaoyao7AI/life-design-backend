/**
 * 周报生成工具
 *
 * 从 todos 数据中聚合一周的统计信息，生成 report_data JSON。
 * MVP 阶段使用规则引擎生成洞察与建议，后续可接入 LLM。
 */

const TAG_HEALTH = "健康";
const TAG_WORK = "工作";
const TAG_INTEREST = "兴趣";
const TAG_LOVE = "爱";
const ALL_TAGS = [TAG_HEALTH, TAG_WORK, TAG_INTEREST, TAG_LOVE];

const TAG_EN_MAP = {
  [TAG_HEALTH]: "health",
  [TAG_WORK]: "work",
  [TAG_INTEREST]: "interest",
  [TAG_LOVE]: "love",
};

const RADAR_DIMENSIONS = [
  "body_energy",
  "info_input",
  "creative_expression",
  "social_connection",
  "emotional_recovery",
];

/**
 * 根据周起止日期获取该用户当周已完成的 todos
 */
export async function fetchWeekTodos(pool, userId, weekStart, weekEnd) {
  const [rows] = await pool.query(
    `SELECT id, content, tag, due_at, completed, completed_at, created_at, updated_at
     FROM todos
     WHERE user_id = ?
       AND deleted_at IS NULL
       AND completed = 1
       AND completed_at >= ?
       AND completed_at < DATE_ADD(?, INTERVAL 1 DAY)
     ORDER BY completed_at ASC`,
    [userId, weekStart, weekEnd]
  );
  return rows;
}

/**
 * 基于 todo 内容推断活动时长（小时）
 * MVP: 每个已完成 todo 默认 0.5h，可根据关键词调整
 */
function estimateDurationHours(todo) {
  const content = (todo.content || "").toLowerCase();
  const durationMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:小时|h|hr)/i);
  if (durationMatch) return parseFloat(durationMatch[1]);
  const minMatch = content.match(/(\d+)\s*(?:分钟|min)/i);
  if (minMatch) return parseFloat(minMatch[1]) / 60;
  return 0.5;
}

/**
 * 按 tag 维度统计时间分布
 */
function calcTimeDistribution(todos) {
  const byTag = {};
  for (const tag of ALL_TAGS) {
    byTag[TAG_EN_MAP[tag]] = { hours: 0, count: 0 };
  }
  let untaggedHours = 0;

  for (const todo of todos) {
    const h = estimateDurationHours(todo);
    const tag = todo.tag;
    const key = TAG_EN_MAP[tag];
    if (key && byTag[key]) {
      byTag[key].hours += h;
      byTag[key].count += 1;
    } else {
      untaggedHours += h;
    }
  }

  const totalHours =
    Object.values(byTag).reduce((s, v) => s + v.hours, 0) + untaggedHours;

  for (const key of Object.keys(byTag)) {
    byTag[key].hours = round2(byTag[key].hours);
    byTag[key].percentage =
      totalHours > 0 ? round1((byTag[key].hours / totalHours) * 100) : 0;
  }

  return { by_tag: byTag, total_hours: round2(totalHours), untagged_hours: round2(untaggedHours) };
}

/**
 * 计算生命力输出雷达图分值（0-5）
 * 基于 todo 内容关键词匹配
 */
function calcRadarScores(todos) {
  const scores = {
    body_energy: 0,
    info_input: 0,
    creative_expression: 0,
    social_connection: 0,
    emotional_recovery: 0,
  };

  const keywords = {
    body_energy: ["健身", "跑步", "游泳", "瑜伽", "运动", "锻炼", "体能", "针灸", "拉伸", "散步", "走路", "骑行"],
    info_input: ["阅读", "读书", "看书", "讲座", "课程", "学习", "听课", "播客", "podcast", "纪录片", "研究"],
    creative_expression: ["写作", "编程", "设计", "画画", "音乐", "创作", "制作", "开发", "coding", "摄影", "视频"],
    social_connection: ["聚会", "约饭", "社交", "见面", "电话", "聊天", "陪伴", "朋友", "家人", "团建"],
    emotional_recovery: ["冥想", "日记", "反思", "复盘", "散步", "休息", "spa", "按摩", "泡澡", "独处", "正念"],
  };

  const counts = {};
  for (const dim of RADAR_DIMENSIONS) counts[dim] = 0;

  for (const todo of todos) {
    const content = (todo.content || "").toLowerCase();
    for (const dim of RADAR_DIMENSIONS) {
      for (const kw of keywords[dim]) {
        if (content.includes(kw)) {
          counts[dim] += 1;
          break;
        }
      }
    }
  }

  for (const dim of RADAR_DIMENSIONS) {
    scores[dim] = Math.min(5, round1(counts[dim] * 1.5));
  }

  return scores;
}

/**
 * 生成行为数据表
 */
function buildBehaviorTable(todos, radarScores) {
  const behaviorMap = {
    body_energy: { label: "身体能量管理", keywords: ["健身", "运动", "锻炼", "针灸", "瑜伽", "冥想", "跑步"] },
    info_input: { label: "信息输入吸收", keywords: ["阅读", "讲座", "课程", "学习", "播客"] },
    creative_expression: { label: "创造表达", keywords: ["写作", "编程", "设计", "创作", "制作"] },
    social_connection: { label: "社交链接", keywords: ["聚会", "社交", "聊天", "陪伴", "朋友"] },
    emotional_recovery: { label: "情绪恢复/内观", keywords: ["冥想", "反思", "复盘", "日记", "正念"] },
  };

  const behaviors = [];
  for (const dim of RADAR_DIMENSIONS) {
    const matched = [];
    for (const todo of todos) {
      const content = todo.content || "";
      for (const kw of behaviorMap[dim].keywords) {
        if (content.includes(kw)) {
          matched.push(content.length > 20 ? content.slice(0, 20) + "…" : content);
          break;
        }
      }
    }
    const desc = matched.length > 0
      ? matched.slice(0, 3).join("、")
      : "无相关活动记录";
    behaviors.push({
      type: behaviorMap[dim].label,
      dimension: dim,
      score: radarScores[dim],
      description: desc,
    });
  }
  return behaviors;
}

/**
 * 生成分析洞察（规则引擎，MVP）
 */
function generateInsights(timeDistribution) {
  const insights = {};
  const { by_tag, total_hours } = timeDistribution;

  for (const [zhTag, enTag] of Object.entries(TAG_EN_MAP)) {
    const data = by_tag[enTag];
    if (!data || data.hours === 0) {
      insights[enTag] = {
        tag_label: zhTag,
        summary: "完全缺失",
        level: "missing",
        detail: `本周在「${zhTag}」维度没有任何记录，这是本周的盲区。`,
      };
    } else if (data.percentage >= 40) {
      insights[enTag] = {
        tag_label: zhTag,
        summary: "偏好明显",
        level: "high",
        detail: `${zhTag}活动占比 ${data.percentage}%，投入大量时间。`,
      };
    } else if (data.percentage >= 20) {
      insights[enTag] = {
        tag_label: zhTag,
        summary: "分布合理",
        level: "good",
        detail: `${zhTag}活动占比 ${data.percentage}%，维度分布合理。`,
      };
    } else {
      insights[enTag] = {
        tag_label: zhTag,
        summary: "投入偏低",
        level: "low",
        detail: `${zhTag}活动占比仅 ${data.percentage}%，投入较少。`,
      };
    }
  }
  return insights;
}

/**
 * 生成 AI 建议（规则引擎，MVP）
 */
function generateSuggestions(insights, radarScores, timeDistribution) {
  const suggestions = [];

  const missing = Object.entries(insights)
    .filter(([_, v]) => v.level === "missing")
    .map(([_, v]) => v.tag_label);

  if (missing.length > 0) {
    suggestions.push(
      `本周「${missing.join("、")}」维度完全缺失，建议下周至少安排 1-2 项相关活动，保持生活的平衡。`
    );
  }

  const lowRadar = Object.entries(radarScores)
    .filter(([_, v]) => v <= 1)
    .map(([k]) => {
      const map = {
        body_energy: "身体能量管理",
        info_input: "信息输入吸收",
        creative_expression: "创造表达",
        social_connection: "社交链接",
        emotional_recovery: "情绪恢复/内观",
      };
      return map[k];
    });

  if (lowRadar.length > 0) {
    suggestions.push(
      `「${lowRadar.join("、")}」的生命力输出较弱，试着在下周加入一些小行动来激活这些维度。`
    );
  }

  const high = Object.entries(insights)
    .filter(([_, v]) => v.level === "high")
    .map(([_, v]) => v.tag_label);

  if (high.length > 0 && missing.length > 0) {
    suggestions.push(
      `你在「${high.join("、")}」上投入充足，但别忘了「${missing.join("、")}」的重要性——均衡的生活设计才是可持续的。`
    );
  }

  if (timeDistribution.total_hours < 5) {
    suggestions.push(
      "本周记录的活动总时长较少，建议养成随手记录的习惯，让数据更完整地反映你的生活。"
    );
  }

  if (suggestions.length === 0) {
    suggestions.push("本周各维度分布均衡，继续保持！可以尝试在薄弱环节做一些小实验。");
  }

  return suggestions;
}

/**
 * 主函数：从 todos 生成完整的 report_data
 */
export async function generateReportData(pool, userId, weekStart, weekEnd) {
  const todos = await fetchWeekTodos(pool, userId, weekStart, weekEnd);

  const completedCount = todos.length;
  const timeDistribution = calcTimeDistribution(todos);
  const radarScores = calcRadarScores(todos);
  const behaviors = buildBehaviorTable(todos, radarScores);
  const insights = generateInsights(timeDistribution);
  const suggestions = generateSuggestions(insights, radarScores, timeDistribution);

  return {
    week_start: weekStart,
    week_end: weekEnd,
    generated_at: new Date().toISOString(),
    todo_stats: {
      completed: completedCount,
    },
    time_distribution: timeDistribution.by_tag,
    total_hours: timeDistribution.total_hours,
    radar: radarScores,
    behaviors,
    insights,
    suggestions,
  };
}

/**
 * 获取本周的起止日期（周一 ~ 周日）
 */
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
    end: formatDate(sunday),
  };
}

/**
 * 获取指定偏移量的周范围（0=本周，-1=上周，...）
 */
export function getWeekRangeByOffset(offset = 0) {
  const { start } = getCurrentWeekRange();
  const monday = new Date(start + "T00:00:00");
  monday.setDate(monday.getDate() + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  };
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
