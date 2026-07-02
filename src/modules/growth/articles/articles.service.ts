import { articleRepository, ArticleRow } from "./article.repository.js";
import {
  canAccessArticle as canAccessArticleByMembership,
  membershipService,
} from "../membership/membership.service.js";

type ArticleStatus = "draft" | "published" | "archived";
type ArticleVisibility = "public" | "members_only";
type MembershipTier = "free" | "founder";

type ListQuery = {
  page?: unknown;
  page_size?: unknown;
  keyword?: unknown;
  topic_id?: unknown;
  status?: unknown;
  sort?: unknown;
};

type ArticlePayload = {
  title?: unknown;
  title_en?: unknown;
  topic_id?: unknown;
  content?: unknown;
  status?: unknown;
  visibility?: unknown;
  membership_tier?: unknown;
  cover_url?: unknown;
  reading_time_minutes?: unknown;
  author_id?: unknown;
};

export class ArticleServiceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function normalizePage(input: unknown, fallback: number) {
  if (input === undefined || input === null || input === "") return fallback;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ArticleServiceError("VALIDATION_ERROR", "page 非法");
  }
  return Math.floor(n);
}

function normalizePageSize(input: unknown, fallback: number, max = 100) {
  if (input === undefined || input === null || input === "") return fallback;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ArticleServiceError("VALIDATION_ERROR", "page_size 非法");
  }
  return Math.min(Math.floor(n), max);
}

function normalizeStatus(input: unknown, fallback?: ArticleStatus): ArticleStatus | undefined {
  if (input === undefined || input === null || input === "") return fallback;
  const v = String(input).trim().toLowerCase();
  if (v === "draft" || v === "published" || v === "archived") return v;
  throw new ArticleServiceError("VALIDATION_ERROR", "status 非法");
}

function normalizeVisibility(input: unknown, fallback: ArticleVisibility): ArticleVisibility {
  if (input === undefined || input === null || input === "") return fallback;
  const v = String(input).trim().toLowerCase();
  if (v === "public" || v === "members_only") return v;
  throw new ArticleServiceError("VALIDATION_ERROR", "visibility 非法");
}

function normalizeMembershipTier(input: unknown, fallback: MembershipTier): MembershipTier {
  if (input === undefined || input === null || input === "") return fallback;
  const v = String(input).trim().toLowerCase();
  if (v === "free" || v === "founder") return v;
  throw new ArticleServiceError("VALIDATION_ERROR", "membership_tier 非法");
}

function normalizeTopicId(input: unknown): number | null {
  if (input === undefined || input === null || input === "") return null;
  const n = Number(input);
  if (!Number.isFinite(n) || n <= 0) {
    throw new ArticleServiceError("VALIDATION_ERROR", "topic_id 非法");
  }
  return Math.floor(n);
}

function normalizeReadingTime(input: unknown, fallback = 0): number {
  if (input === undefined || input === null || input === "") return fallback;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) {
    throw new ArticleServiceError("VALIDATION_ERROR", "reading_time_minutes 非法");
  }
  return Math.floor(n);
}

function normalizeString(input: unknown): string {
  return String(input ?? "").trim();
}

function normalizeContent(input: unknown): string {
  if (input === undefined || input === null) {
    throw new ArticleServiceError("VALIDATION_ERROR", "content 不能为空");
  }
  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) throw new ArticleServiceError("VALIDATION_ERROR", "content 不能为空");
    try {
      JSON.parse(raw);
      return raw;
    } catch {
      throw new ArticleServiceError("VALIDATION_ERROR", "content 必须是合法 JSON");
    }
  }
  try {
    return JSON.stringify(input);
  } catch {
    throw new ArticleServiceError("VALIDATION_ERROR", "content 必须是合法 JSON");
  }
}

function normalizeSort(input: unknown) {
  if (input === undefined || input === null || input === "") return "published_desc";
  const v = String(input).trim().toLowerCase();
  if (v === "published_desc" || v === "published_asc" || v === "created_desc") return v;
  throw new ArticleServiceError(
    "VALIDATION_ERROR",
    "sort 仅支持 published_desc/published_asc/created_desc"
  );
}

function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || `article-${Date.now()}`;
}

async function buildUniqueSlug(baseTitle: string, ignoreId?: string) {
  const baseSlug = slugify(baseTitle);
  let candidate = baseSlug;
  let i = 1;
  while (true) {
    const existed = await articleRepository.findBySlug(candidate, false);
    if (!existed || existed.id === ignoreId) {
      return candidate;
    }
    i += 1;
    candidate = `${baseSlug}-${i}`;
  }
}

function serializeArticle(article: ArticleRow, includeAccess = false) {
  const data = {
    id: article.id,
    title: article.title,
    title_en: article.title_en,
    slug: article.slug,
    topic_id: article.topic_id,
    topic_name: article.topic_name,
    content: article.content,
    status: article.status,
    visibility: article.visibility,
    membership_tier: article.membership_tier,
    cover_url: article.cover_url,
    views: article.views,
    likes: article.likes,
    reading_time_minutes: article.reading_time_minutes,
    author_id: article.author_id,
    published_at: article.published_at ? article.published_at.toISOString() : null,
    created_at: article.created_at.toISOString(),
    updated_at: article.updated_at.toISOString(),
  };

  if (!includeAccess) return data;
  return {
    ...data,
    access: {
      can_view_full_content: article.visibility === "public",
      required_tier: article.membership_tier,
      upgrade_tip: article.visibility === "public" ? "" : "升级会员可查看完整内容",
    },
  };
}

async function getArticleOrThrowById(id: string) {
  const article = await articleRepository.findById(id);
  if (!article) {
    throw new ArticleServiceError("ARTICLE_NOT_FOUND", "文章不存在", 404);
  }
  return article;
}

async function getArticleOrThrowBySlug(slug: string, appMode = true) {
  const article = await articleRepository.findBySlug(slug, appMode);
  if (!article) {
    throw new ArticleServiceError("ARTICLE_NOT_FOUND", "文章不存在", 404);
  }
  return article;
}

export const articleService = {
  async findCmsList(query: ListQuery) {
    const page = normalizePage(query.page, 1);
    const pageSize = normalizePageSize(query.page_size, 20);
    const result = await articleRepository.findList({
      page,
      page_size: pageSize,
      keyword: query.keyword ? normalizeString(query.keyword) : undefined,
      topic_id: normalizeTopicId(query.topic_id),
      status: normalizeStatus(query.status),
      sort: normalizeSort(query.sort),
      app_mode: false,
    });

    return {
      items: result.items.map((item) => serializeArticle(item, false)),
      pagination: {
        page,
        page_size: pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / pageSize),
      },
    };
  },

  async findAppList(query: ListQuery & { user_id?: unknown }) {
    const page = normalizePage(query.page, 1);
    const pageSize = normalizePageSize(query.page_size, 20);
    const userId = query.user_id ? normalizeString(query.user_id) : "";
    const membership = userId ? await membershipService.getCurrentMembership(userId) : null;
    const result = await articleRepository.findList({
      page,
      page_size: pageSize,
      keyword: query.keyword ? normalizeString(query.keyword) : undefined,
      topic_id: normalizeTopicId(query.topic_id),
      status: "published",
      sort: normalizeSort(query.sort),
      app_mode: true,
    });

    return {
      items: result.items.map((item) => {
        const access = canAccessArticleByMembership({
          membershipState: membership?.membership_state || "free",
          visibility: item.visibility,
          requiredTier: item.membership_tier,
        });
        return {
          ...serializeArticle(item, false),
          access,
        };
      }),
      pagination: {
        page,
        page_size: pageSize,
        total: result.total,
        total_pages: Math.ceil(result.total / pageSize),
      },
    };
  },

  async findById(id: string) {
    const article = await getArticleOrThrowById(id);
    return serializeArticle(article, false);
  },

  async findBySlug(slug: string, userId?: string) {
    const article = await getArticleOrThrowBySlug(slug, true);
    const membership = userId ? await membershipService.getCurrentMembership(userId) : null;
    const access = canAccessArticleByMembership({
      membershipState: membership?.membership_state || "free",
      visibility: article.visibility,
      requiredTier: article.membership_tier,
    });
    return {
      ...serializeArticle(article, false),
      access,
    };
  },

  async create(payload: ArticlePayload) {
    const title = normalizeString(payload.title);
    if (!title) throw new ArticleServiceError("VALIDATION_ERROR", "title 不能为空");
    const slug = await buildUniqueSlug(title);

    const article = await articleRepository.create({
      title,
      title_en: payload.title_en == null ? null : normalizeString(payload.title_en),
      slug,
      topic_id: normalizeTopicId(payload.topic_id),
      content: normalizeContent(payload.content),
      status: normalizeStatus(payload.status, "draft") || "draft",
      visibility: normalizeVisibility(payload.visibility, "public"),
      membership_tier: normalizeMembershipTier(payload.membership_tier, "free"),
      cover_url: payload.cover_url == null ? null : normalizeString(payload.cover_url),
      reading_time_minutes: normalizeReadingTime(payload.reading_time_minutes, 0),
      author_id: normalizeString(payload.author_id) || "system",
      published_at: null,
    });

    return serializeArticle(article, false);
  },

  async update(id: string, payload: ArticlePayload) {
    const existing = await getArticleOrThrowById(id);
    const title = payload.title !== undefined ? normalizeString(payload.title) : existing.title;
    if (!title) throw new ArticleServiceError("VALIDATION_ERROR", "title 不能为空");

    const slug =
      payload.title !== undefined
        ? await buildUniqueSlug(title, existing.id)
        : existing.slug;

    const updated = await articleRepository.update(id, {
      title,
      title_en:
        payload.title_en !== undefined
          ? payload.title_en == null
            ? null
            : normalizeString(payload.title_en)
          : existing.title_en,
      slug,
      topic_id:
        payload.topic_id !== undefined ? normalizeTopicId(payload.topic_id) : existing.topic_id,
      content: payload.content !== undefined ? normalizeContent(payload.content) : undefined,
      status:
        payload.status !== undefined
          ? normalizeStatus(payload.status, existing.status)
          : existing.status,
      visibility:
        payload.visibility !== undefined
          ? normalizeVisibility(payload.visibility, existing.visibility)
          : existing.visibility,
      membership_tier:
        payload.membership_tier !== undefined
          ? normalizeMembershipTier(payload.membership_tier, existing.membership_tier)
          : existing.membership_tier,
      cover_url:
        payload.cover_url !== undefined
          ? payload.cover_url == null
            ? null
            : normalizeString(payload.cover_url)
          : existing.cover_url,
      reading_time_minutes:
        payload.reading_time_minutes !== undefined
          ? normalizeReadingTime(payload.reading_time_minutes, existing.reading_time_minutes)
          : existing.reading_time_minutes,
      author_id:
        payload.author_id !== undefined ? normalizeString(payload.author_id) : existing.author_id,
    });

    if (!updated) {
      throw new ArticleServiceError("ARTICLE_NOT_FOUND", "文章不存在", 404);
    }
    return serializeArticle(updated, false);
  },

  async remove(id: string) {
    const existed = await articleRepository.delete(id);
    if (!existed) {
      throw new ArticleServiceError("ARTICLE_NOT_FOUND", "文章不存在", 404);
    }
    return { id, deleted: true };
  },

  async publish(id: string) {
    await getArticleOrThrowById(id);
    const article = await articleRepository.publish(id);
    if (!article) {
      throw new ArticleServiceError("ARTICLE_NOT_FOUND", "文章不存在", 404);
    }
    return serializeArticle(article, false);
  },

  async incrementView(slug: string) {
    const article = await getArticleOrThrowBySlug(slug, true);
    const views = await articleRepository.incrementView(article.id);
    return { slug, views };
  },

  async incrementLike(slug: string) {
    const article = await getArticleOrThrowBySlug(slug, true);
    const likes = await articleRepository.incrementLike(article.id);
    return { slug, likes };
  },
};
