export const SECONDARY_DIMENSION_RULES = [
  { key: "body_energy", label: "身体能量", keywords: ["运动", "睡眠", "拉伸", "健身", "跑步", "恢复"] },
  { key: "emotion_recovery", label: "情绪恢复", keywords: ["冥想", "平静", "满足", "快乐", "焦虑", "压抑"] },
  { key: "deep_work", label: "深度工作", keywords: ["深度工作", "专注", "高投入", "高输出"] },
  { key: "creative_expression", label: "创造表达", keywords: ["写作", "表达", "设计", "创作", "分享"] },
  { key: "info_input", label: "信息输入", keywords: ["学习", "阅读", "课程", "信息", "刷"] },
  { key: "social_connection", label: "社交连接", keywords: ["交流", "陪伴", "支持", "朋友", "家人"] },
  { key: "play_nourishment", label: "玩乐滋养", keywords: ["玩", "旅行", "兴趣", "无目的", "快乐"] },
  { key: "prototype_explore", label: "人生原型探索", keywords: ["尝试", "探索", "原型", "新方向"] }
];

export const PREDICAMENT_RULES = {
  gravity: {
    name: "重力问题",
    keywords: ["无法", "没办法", "只能", "不得不", "改变不了"],
    threshold: 2
  },
  anchoring: {
    name: "锚定问题",
    keywords: ["只有", "唯一方案", "只能这样", "一直失败", "反复失败"],
    threshold: 1
  },
  action: {
    name: "行动问题",
    keywords: ["想很多", "拖延", "没做", "没开始"],
    threshold: 3
  },
  energy: {
    name: "能量问题",
    keywords: [],
    threshold: 3
  },
  structure: {
    name: "结构问题",
    keywords: ["太大", "太难", "无从下手", "没拆分", "太复杂"],
    threshold: 1
  }
};
