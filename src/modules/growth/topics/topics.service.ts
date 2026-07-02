import { topicRepository, TopicRow } from "./topic.repository.js";

type TopicStatus = "active" | "inactive";

type CreateTopicPayload = {
  name?: string;
  icon_url?: string | null;
  sort_order?: number;
  status?: TopicStatus;
};

type UpdateTopicPayload = {
  name?: string;
  icon_url?: string | null;
  sort_order?: number;
  status?: TopicStatus;
};

type UpdateSortPayload = {
  items?: Array<{ id?: number; sort_order?: number }>;
};

export class TopicServiceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function normalizeName(name: unknown): string {
  return String(name || "").trim();
}

function normalizeIconUrl(iconUrl: unknown): string | null {
  if (iconUrl === undefined) return null;
  if (iconUrl === null) return null;
  const value = String(iconUrl).trim();
  return value || null;
}

function normalizeSortOrder(input: unknown, fallback = 0): number {
  if (input === undefined || input === null || input === "") return fallback;
  const value = Number(input);
  if (!Number.isFinite(value)) {
    throw new TopicServiceError("VALIDATION_ERROR", "sort_order 必须是数字");
  }
  return Math.floor(value);
}

function normalizeStatus(input: unknown, fallback: TopicStatus = "active"): TopicStatus {
  if (input === undefined || input === null || input === "") return fallback;
  const value = String(input).trim().toLowerCase();
  if (value === "active" || value === "inactive") {
    return value;
  }
  throw new TopicServiceError("VALIDATION_ERROR", "status 必须是 active 或 inactive");
}

function slugify(name: string): string {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || `topic-${Date.now()}`;
}

function serializeTopic(topic: TopicRow) {
  return {
    id: topic.id,
    name: topic.name,
    slug: topic.slug,
    icon_url: topic.icon_url,
    sort_order: topic.sort_order,
    status: topic.status,
    article_count: topic.article_count,
    created_at: topic.created_at.toISOString(),
    updated_at: topic.updated_at.toISOString(),
  };
}

async function ensureNameNotDuplicated(name: string, ignoreId?: number) {
  const existingByName = await topicRepository.findByName(name);
  if (existingByName && existingByName.id !== ignoreId) {
    throw new TopicServiceError("TOPIC_NAME_EXISTS", "Topic 名称已存在", 409);
  }
}

async function ensureSlugNotDuplicated(slug: string, ignoreId?: number) {
  const existingBySlug = await topicRepository.findBySlug(slug);
  if (existingBySlug && existingBySlug.id !== ignoreId) {
    throw new TopicServiceError("TOPIC_SLUG_EXISTS", "Topic slug 已存在", 409);
  }
}

async function getTopicOrThrow(id: number) {
  const topic = await topicRepository.findById(id);
  if (!topic) {
    throw new TopicServiceError("TOPIC_NOT_FOUND", "Topic 不存在", 404);
  }
  return topic;
}

export const topicService = {
  async findAllCms(query: { keyword?: string; status?: TopicStatus }) {
    const status = query.status ? normalizeStatus(query.status) : undefined;
    const keyword = query.keyword ? String(query.keyword).trim() : undefined;
    const rows = await topicRepository.findAll({ status, keyword });
    return rows.map(serializeTopic);
  },

  async findAllApp() {
    const rows = await topicRepository.findAll({ status: "active" });
    return rows.map(serializeTopic);
  },

  async create(payload: CreateTopicPayload) {
    const name = normalizeName(payload.name);
    if (!name) {
      throw new TopicServiceError("VALIDATION_ERROR", "name 不能为空");
    }
    const slug = slugify(name);
    await ensureNameNotDuplicated(name);
    await ensureSlugNotDuplicated(slug);

    const created = await topicRepository.create({
      name,
      slug,
      icon_url: normalizeIconUrl(payload.icon_url),
      sort_order: normalizeSortOrder(payload.sort_order, 0),
      status: normalizeStatus(payload.status, "active"),
    });

    return serializeTopic(created);
  },

  async update(idInput: unknown, payload: UpdateTopicPayload) {
    const id = Number(idInput);
    if (!Number.isFinite(id) || id <= 0) {
      throw new TopicServiceError("VALIDATION_ERROR", "id 非法");
    }

    const existing = await getTopicOrThrow(id);
    const name = payload.name !== undefined ? normalizeName(payload.name) : existing.name;
    if (!name) {
      throw new TopicServiceError("VALIDATION_ERROR", "name 不能为空");
    }

    const slug = slugify(name);
    await ensureNameNotDuplicated(name, id);
    await ensureSlugNotDuplicated(slug, id);

    const updated = await topicRepository.update(id, {
      name,
      slug,
      icon_url:
        payload.icon_url !== undefined ? normalizeIconUrl(payload.icon_url) : existing.icon_url,
      sort_order:
        payload.sort_order !== undefined
          ? normalizeSortOrder(payload.sort_order, existing.sort_order)
          : existing.sort_order,
      status:
        payload.status !== undefined
          ? normalizeStatus(payload.status, existing.status)
          : existing.status,
    });

    if (!updated) {
      throw new TopicServiceError("TOPIC_NOT_FOUND", "Topic 不存在", 404);
    }
    return serializeTopic(updated);
  },

  async delete(idInput: unknown) {
    const id = Number(idInput);
    if (!Number.isFinite(id) || id <= 0) {
      throw new TopicServiceError("VALIDATION_ERROR", "id 非法");
    }

    await getTopicOrThrow(id);
    const articleCount = await topicRepository.countArticles(id);
    if (articleCount > 0) {
      throw new TopicServiceError(
        "TOPIC_NOT_EMPTY",
        "Topic 下存在文章，不能删除",
        409
      );
    }

    await topicRepository.delete(id);
    return { id, deleted: true };
  },

  async updateSort(payload: UpdateSortPayload) {
    const items = payload?.items;
    if (!Array.isArray(items) || items.length === 0) {
      throw new TopicServiceError("VALIDATION_ERROR", "items 不能为空");
    }

    const normalized = items.map((item) => {
      const id = Number(item.id);
      const sortOrder = Number(item.sort_order);
      if (!Number.isFinite(id) || id <= 0) {
        throw new TopicServiceError("VALIDATION_ERROR", "sort item id 非法");
      }
      if (!Number.isFinite(sortOrder)) {
        throw new TopicServiceError("VALIDATION_ERROR", "sort_order 非法");
      }
      return {
        id: Math.floor(id),
        sort_order: Math.floor(sortOrder),
      };
    });

    await topicRepository.updateSort(normalized);
    return { updated_count: normalized.length };
  },
};
