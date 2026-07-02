import { articleRepository } from "../articles/article.repository.js";
import { membershipRepository } from "./membership.repository.js";

type Tier = "free" | "founder";
type MembershipStatus = "active" | "expired" | "canceled";

type CreateMembershipPayload = {
  user_id?: unknown;
  tier?: unknown;
  status?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  auto_renew?: unknown;
};

type UpdateMembershipPayload = Partial<CreateMembershipPayload>;

type CreatePlanPayload = {
  code?: unknown;
  name?: unknown;
  tier?: unknown;
  billing_cycle?: unknown;
  price_cents?: unknown;
  original_price_cents?: unknown;
  benefits?: unknown;
  status?: unknown;
  sort_order?: unknown;
};

type AccessCheckPayload = {
  user_id?: unknown;
  article_id?: unknown;
  slug?: unknown;
};

export class MembershipServiceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function normalizeString(input: unknown) {
  return String(input ?? "").trim();
}

function normalizeTier(input: unknown, fallback: Tier = "free"): Tier {
  if (input === undefined || input === null || input === "") return fallback;
  const value = String(input).trim().toLowerCase();
  if (value === "free" || value === "founder") return value;
  throw new MembershipServiceError("VALIDATION_ERROR", "tier 必须是 free 或 founder");
}

function normalizeStatus(input: unknown, fallback: MembershipStatus = "active"): MembershipStatus {
  if (input === undefined || input === null || input === "") return fallback;
  const value = String(input).trim().toLowerCase();
  if (value === "active" || value === "expired" || value === "canceled") return value;
  throw new MembershipServiceError("VALIDATION_ERROR", "status 非法");
}

function normalizeBool(input: unknown, fallback = false) {
  if (input === undefined || input === null || input === "") return fallback;
  if (typeof input === "boolean") return input;
  const value = String(input).trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function normalizeDate(input: unknown, fallback: Date) {
  if (input === undefined || input === null || input === "") return fallback;
  const d = new Date(String(input));
  if (!Number.isFinite(d.getTime())) {
    throw new MembershipServiceError("VALIDATION_ERROR", "日期格式非法");
  }
  return d;
}

function normalizeNullableDate(input: unknown): Date | null {
  if (input === undefined || input === null || input === "") return null;
  const d = new Date(String(input));
  if (!Number.isFinite(d.getTime())) {
    throw new MembershipServiceError("VALIDATION_ERROR", "日期格式非法");
  }
  return d;
}

function normalizeInt(input: unknown, fallback = 0) {
  if (input === undefined || input === null || input === "") return fallback;
  const n = Number(input);
  if (!Number.isFinite(n)) {
    throw new MembershipServiceError("VALIDATION_ERROR", "数值参数非法");
  }
  return Math.floor(n);
}

function serializePlan(plan: any) {
  return {
    id: plan.id,
    code: plan.code,
    name: plan.name,
    tier: plan.tier,
    billing_cycle: plan.billing_cycle,
    price_cents: plan.price_cents,
    original_price_cents: plan.original_price_cents,
    benefits: plan.benefits,
    status: plan.status,
    sort_order: plan.sort_order,
    created_at: plan.created_at.toISOString(),
  };
}

function deriveMembershipState(input: {
  tier: Tier;
  status: MembershipStatus;
  end_at: Date | null;
}) {
  if (input.status === "canceled") return "expired";
  if (input.status === "expired") return "expired";
  if (input.end_at && input.end_at.getTime() < Date.now()) return "expired";
  return input.tier;
}

export function canCreateVision(membershipState: "free" | "founder" | "expired") {
  return membershipState === "free" || membershipState === "founder";
}

export function canCreateUnlimitedVision(membershipState: "free" | "founder" | "expired") {
  return membershipState === "founder";
}

export function canUsePremiumTemplate(membershipState: "free" | "founder" | "expired") {
  return membershipState === "founder";
}

export function canAccessArticle(input: {
  membershipState: "free" | "founder" | "expired";
  visibility: "public" | "members_only";
  requiredTier: Tier;
}) {
  if (input.visibility === "public") {
    return {
      can_view_full_content: true,
      required_tier: "free",
      upgrade_tip: "",
    };
  }

  if (input.requiredTier === "free") {
    return {
      can_view_full_content: true,
      required_tier: "free",
      upgrade_tip: "",
    };
  }

  const canView = input.membershipState === "founder";
  return {
    can_view_full_content: canView,
    required_tier: "founder",
    upgrade_tip: canView ? "" : "升级 Founder 会员可查看完整内容",
  };
}

async function getUserMembershipOrDefault(userId: string) {
  const membership = await membershipRepository.findUserMembership(userId);
  if (!membership) {
    return {
      user_id: userId,
      tier: "free" as Tier,
      status: "active" as MembershipStatus,
      start_at: new Date(0),
      end_at: null as Date | null,
      auto_renew: false,
      membership_state: "free" as "free" | "founder" | "expired",
      permissions: {
        can_create_vision: true,
        can_create_unlimited_vision: false,
        can_use_premium_template: false,
      },
    };
  }

  const membershipState = deriveMembershipState({
    tier: membership.tier,
    status: membership.status,
    end_at: membership.end_at,
  });

  return {
    id: membership.id,
    user_id: membership.user_id,
    tier: membership.tier,
    status: membership.status,
    start_at: membership.start_at.toISOString(),
    end_at: membership.end_at ? membership.end_at.toISOString() : null,
    auto_renew: membership.auto_renew,
    membership_state: membershipState,
    permissions: {
      can_create_vision: canCreateVision(membershipState),
      can_create_unlimited_vision: canCreateUnlimitedVision(membershipState),
      can_use_premium_template: canUsePremiumTemplate(membershipState),
    },
  };
}

export const membershipService = {
  async getPlans() {
    const plans = await membershipRepository.findPlans();
    return plans.map(serializePlan);
  },

  async getCurrentMembership(userId: string) {
    if (!userId) {
      throw new MembershipServiceError("VALIDATION_ERROR", "user_id 不能为空");
    }
    return getUserMembershipOrDefault(userId);
  },

  async createMembership(payload: CreateMembershipPayload) {
    const userId = normalizeString(payload.user_id);
    if (!userId) {
      throw new MembershipServiceError("VALIDATION_ERROR", "user_id 不能为空");
    }
    const created = await membershipRepository.createMembership({
      user_id: userId,
      tier: normalizeTier(payload.tier, "free"),
      status: normalizeStatus(payload.status, "active"),
      start_at: normalizeDate(payload.start_at, new Date()),
      end_at: normalizeNullableDate(payload.end_at),
      auto_renew: normalizeBool(payload.auto_renew, false),
    });
    if (!created) {
      throw new MembershipServiceError("INTERNAL_ERROR", "会员创建失败", 500);
    }
    return getUserMembershipOrDefault(created.user_id);
  },

  async updateMembership(id: string, payload: UpdateMembershipPayload) {
    const membershipId = normalizeString(id);
    if (!membershipId) {
      throw new MembershipServiceError("VALIDATION_ERROR", "membership id 不能为空");
    }
    const updated = await membershipRepository.updateMembership(membershipId, {
      tier: payload.tier !== undefined ? normalizeTier(payload.tier, "free") : undefined,
      status: payload.status !== undefined ? normalizeStatus(payload.status, "active") : undefined,
      start_at: payload.start_at !== undefined ? normalizeDate(payload.start_at, new Date()) : undefined,
      end_at: payload.end_at !== undefined ? normalizeNullableDate(payload.end_at) : undefined,
      auto_renew:
        payload.auto_renew !== undefined ? normalizeBool(payload.auto_renew, false) : undefined,
    });
    if (!updated) {
      throw new MembershipServiceError("MEMBERSHIP_NOT_FOUND", "会员记录不存在", 404);
    }
    return getUserMembershipOrDefault(updated.user_id);
  },

  async createPlan(payload: CreatePlanPayload) {
    const code = normalizeString(payload.code).toUpperCase();
    const name = normalizeString(payload.name);
    if (!code || !name) {
      throw new MembershipServiceError("VALIDATION_ERROR", "code 与 name 不能为空");
    }
    const plan = await membershipRepository.createPlan({
      code,
      name,
      tier: normalizeTier(payload.tier, "free"),
      billing_cycle: normalizeString(payload.billing_cycle) || "lifetime",
      price_cents: normalizeInt(payload.price_cents, 0),
      original_price_cents:
        payload.original_price_cents === undefined || payload.original_price_cents === null
          ? null
          : normalizeInt(payload.original_price_cents, 0),
      benefits:
        payload.benefits === undefined || payload.benefits === null
          ? null
          : JSON.stringify(payload.benefits),
      status:
        normalizeString(payload.status).toLowerCase() === "inactive" ? "inactive" : "active",
      sort_order: normalizeInt(payload.sort_order, 0),
    });
    if (!plan) {
      throw new MembershipServiceError("INTERNAL_ERROR", "会员套餐创建失败", 500);
    }
    return serializePlan(plan);
  },

  async updatePlan(id: string, payload: CreatePlanPayload) {
    const planId = normalizeString(id);
    if (!planId) {
      throw new MembershipServiceError("VALIDATION_ERROR", "plan id 不能为空");
    }
    const plan = await membershipRepository.updatePlan(planId, {
      code: payload.code !== undefined ? normalizeString(payload.code).toUpperCase() : undefined,
      name: payload.name !== undefined ? normalizeString(payload.name) : undefined,
      tier: payload.tier !== undefined ? normalizeTier(payload.tier, "free") : undefined,
      billing_cycle:
        payload.billing_cycle !== undefined ? normalizeString(payload.billing_cycle) : undefined,
      price_cents:
        payload.price_cents !== undefined ? normalizeInt(payload.price_cents, 0) : undefined,
      original_price_cents:
        payload.original_price_cents !== undefined
          ? payload.original_price_cents === null
            ? null
            : normalizeInt(payload.original_price_cents, 0)
          : undefined,
      benefits:
        payload.benefits !== undefined
          ? payload.benefits === null
            ? null
            : JSON.stringify(payload.benefits)
          : undefined,
      status:
        payload.status !== undefined
          ? normalizeString(payload.status).toLowerCase() === "inactive"
            ? "inactive"
            : "active"
          : undefined,
      sort_order:
        payload.sort_order !== undefined ? normalizeInt(payload.sort_order, 0) : undefined,
    });
    if (!plan) {
      throw new MembershipServiceError("PLAN_NOT_FOUND", "套餐不存在", 404);
    }
    return serializePlan(plan);
  },

  async accessCheck(payload: AccessCheckPayload) {
    const userId = normalizeString(payload.user_id);
    if (!userId) {
      throw new MembershipServiceError("VALIDATION_ERROR", "user_id 不能为空");
    }

    const membership = await getUserMembershipOrDefault(userId);

    let article = null;
    if (payload.article_id) {
      article = await articleRepository.findById(normalizeString(payload.article_id));
    } else if (payload.slug) {
      article = await articleRepository.findBySlug(normalizeString(payload.slug), false);
    } else {
      throw new MembershipServiceError("VALIDATION_ERROR", "article_id 或 slug 必须提供其一");
    }

    if (!article) {
      throw new MembershipServiceError("ARTICLE_NOT_FOUND", "文章不存在", 404);
    }

    const access = canAccessArticle({
      membershipState: membership.membership_state,
      visibility: article.visibility,
      requiredTier: article.membership_tier === "founder" ? "founder" : "free",
    });

    return {
      user_membership: membership,
      article: {
        id: article.id,
        slug: article.slug,
        title: article.title,
        visibility: article.visibility,
        membership_tier: article.membership_tier,
      },
      access,
    };
  },
};
