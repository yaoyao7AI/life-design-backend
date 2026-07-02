import {
  HomeSectionKey,
  HomeStatus,
  homeRepository,
} from "./home.repository.js";

export class HomeServiceError extends Error {
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

function normalizeNullableString(input: unknown) {
  if (input === undefined || input === null) return null;
  const value = String(input).trim();
  return value || null;
}

function normalizeStatus(input: unknown, fallback: HomeStatus = "active"): HomeStatus {
  if (input === undefined || input === null || input === "") return fallback;
  const value = String(input).trim().toLowerCase();
  if (value === "active" || value === "inactive") return value;
  throw new HomeServiceError("VALIDATION_ERROR", "status 非法");
}

function normalizeSortOrder(input: unknown, fallback = 0) {
  if (input === undefined || input === null || input === "") return fallback;
  const n = Number(input);
  if (!Number.isFinite(n)) {
    throw new HomeServiceError("VALIDATION_ERROR", "sort_order 非法");
  }
  return Math.floor(n);
}

function normalizeInt(input: unknown, fallback = 0) {
  if (input === undefined || input === null || input === "") return fallback;
  const n = Number(input);
  if (!Number.isFinite(n)) {
    throw new HomeServiceError("VALIDATION_ERROR", "数值参数非法");
  }
  return Math.floor(n);
}

function serializeBanner(item: any) {
  return {
    id: item.id,
    title: item.title,
    image_url: item.image_url,
    link_url: item.link_url,
    status: item.status,
    sort_order: item.sort_order,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}

function serializeCourse(item: any) {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    cover_url: item.cover_url,
    link_url: item.link_url,
    status: item.status,
    sort_order: item.sort_order,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}

function serializeSection(item: any) {
  return {
    id: item.id,
    section_key: item.section_key,
    title: item.title,
    subtitle: item.subtitle,
    article_limit: item.article_limit,
    status: item.status,
    sort_order: item.sort_order,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}

function serializeMembershipCta(item: any) {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle,
    button_text: item.button_text,
    button_link: item.button_link,
    background_image_url: item.background_image_url,
    status: item.status,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}

function parseId(idInput: unknown) {
  const id = Number(idInput);
  if (!Number.isFinite(id) || id <= 0) {
    throw new HomeServiceError("VALIDATION_ERROR", "id 非法");
  }
  return Math.floor(id);
}

function parseSortItems(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HomeServiceError("VALIDATION_ERROR", "items 不能为空");
  }
  return items.map((item) => {
    const id = parseId((item as any).id);
    const sort_order = normalizeSortOrder((item as any).sort_order, 0);
    return { id, sort_order };
  });
}

async function getSectionOrThrow(sectionKey: HomeSectionKey) {
  const section = await homeRepository.findSection(sectionKey);
  if (!section) {
    throw new HomeServiceError("SECTION_NOT_FOUND", "首页配置不存在", 404);
  }
  return section;
}

export const homeService = {
  async getCmsBanners() {
    const items = await homeRepository.findBanners(false);
    return items.map(serializeBanner);
  },

  async getAppBanners() {
    const items = await homeRepository.findBanners(true);
    return items.map(serializeBanner);
  },

  async createBanner(payload: any) {
    const title = normalizeString(payload?.title);
    const image_url = normalizeString(payload?.image_url);
    if (!title || !image_url) {
      throw new HomeServiceError("VALIDATION_ERROR", "title 与 image_url 不能为空");
    }
    await homeRepository.createBanner({
      title,
      image_url,
      link_url: normalizeNullableString(payload?.link_url),
      status: normalizeStatus(payload?.status, "active"),
      sort_order: normalizeSortOrder(payload?.sort_order, 0),
    });
    return this.getCmsBanners();
  },

  async updateBanner(idInput: unknown, payload: any) {
    const id = parseId(idInput);
    await homeRepository.updateBanner(id, {
      title: payload?.title !== undefined ? normalizeString(payload?.title) : undefined,
      image_url: payload?.image_url !== undefined ? normalizeString(payload?.image_url) : undefined,
      link_url: payload?.link_url !== undefined ? normalizeNullableString(payload?.link_url) : undefined,
      status: payload?.status !== undefined ? normalizeStatus(payload?.status) : undefined,
      sort_order:
        payload?.sort_order !== undefined ? normalizeSortOrder(payload?.sort_order, 0) : undefined,
    });
    return this.getCmsBanners();
  },

  async deleteBanner(idInput: unknown) {
    const id = parseId(idInput);
    const deleted = await homeRepository.deleteBanner(id);
    if (!deleted) {
      throw new HomeServiceError("BANNER_NOT_FOUND", "Banner 不存在", 404);
    }
    return { id, deleted: true };
  },

  async updateBannerSort(payload: any) {
    const items = parseSortItems(payload?.items);
    await homeRepository.updateBannerSort(items);
    return { updated_count: items.length };
  },

  async getCmsSection(sectionKey: HomeSectionKey) {
    const section = await getSectionOrThrow(sectionKey);
    return serializeSection(section);
  },

  async getAppSection(sectionKey: HomeSectionKey) {
    const section = await getSectionOrThrow(sectionKey);
    if (section.status !== "active") {
      throw new HomeServiceError("SECTION_NOT_AVAILABLE", "栏目未启用", 404);
    }
    return serializeSection(section);
  },

  async upsertSection(sectionKey: HomeSectionKey, payload: any) {
    const existing = await homeRepository.findSection(sectionKey);
    const title =
      payload?.title !== undefined
        ? normalizeString(payload.title)
        : existing?.title || (sectionKey === "most_popular" ? "Most Popular" : "Latest");
    if (!title) {
      throw new HomeServiceError("VALIDATION_ERROR", "title 不能为空");
    }

    await homeRepository.upsertSection(sectionKey, {
      title,
      subtitle:
        payload?.subtitle !== undefined
          ? normalizeNullableString(payload.subtitle)
          : existing?.subtitle || null,
      article_limit:
        payload?.article_limit !== undefined
          ? normalizeInt(payload.article_limit, 6)
          : existing?.article_limit || 6,
      status:
        payload?.status !== undefined
          ? normalizeStatus(payload.status, "active")
          : existing?.status || "active",
      sort_order:
        payload?.sort_order !== undefined
          ? normalizeSortOrder(payload.sort_order, 0)
          : existing?.sort_order || 0,
    });
    return this.getCmsSection(sectionKey);
  },

  async getCmsCourses() {
    const items = await homeRepository.findCourses(false);
    return items.map(serializeCourse);
  },

  async getAppCourses() {
    const items = await homeRepository.findCourses(true);
    return items.map(serializeCourse);
  },

  async createCourse(payload: any) {
    const title = normalizeString(payload?.title);
    const cover_url = normalizeString(payload?.cover_url);
    if (!title || !cover_url) {
      throw new HomeServiceError("VALIDATION_ERROR", "title 与 cover_url 不能为空");
    }
    await homeRepository.createCourse({
      title,
      subtitle: normalizeNullableString(payload?.subtitle),
      cover_url,
      link_url: normalizeNullableString(payload?.link_url),
      status: normalizeStatus(payload?.status, "active"),
      sort_order: normalizeSortOrder(payload?.sort_order, 0),
    });
    return this.getCmsCourses();
  },

  async updateCourse(idInput: unknown, payload: any) {
    const id = parseId(idInput);
    await homeRepository.updateCourse(id, {
      title: payload?.title !== undefined ? normalizeString(payload.title) : undefined,
      subtitle: payload?.subtitle !== undefined ? normalizeNullableString(payload.subtitle) : undefined,
      cover_url: payload?.cover_url !== undefined ? normalizeString(payload.cover_url) : undefined,
      link_url: payload?.link_url !== undefined ? normalizeNullableString(payload.link_url) : undefined,
      status: payload?.status !== undefined ? normalizeStatus(payload.status) : undefined,
      sort_order:
        payload?.sort_order !== undefined ? normalizeSortOrder(payload.sort_order, 0) : undefined,
    });
    return this.getCmsCourses();
  },

  async deleteCourse(idInput: unknown) {
    const id = parseId(idInput);
    const deleted = await homeRepository.deleteCourse(id);
    if (!deleted) {
      throw new HomeServiceError("COURSE_NOT_FOUND", "Course 不存在", 404);
    }
    return { id, deleted: true };
  },

  async updateCourseSort(payload: any) {
    const items = parseSortItems(payload?.items);
    await homeRepository.updateCourseSort(items);
    return { updated_count: items.length };
  },

  async getCmsMembershipCta() {
    const cta = await homeRepository.getMembershipCta();
    if (!cta) throw new HomeServiceError("CTA_NOT_FOUND", "会员 CTA 未配置", 404);
    return serializeMembershipCta(cta);
  },

  async getAppMembershipCta() {
    const cta = await homeRepository.getMembershipCta();
    if (!cta || cta.status !== "active") {
      throw new HomeServiceError("CTA_NOT_AVAILABLE", "会员 CTA 未启用", 404);
    }
    return serializeMembershipCta(cta);
  },

  async upsertMembershipCta(payload: any) {
    const existing = await homeRepository.getMembershipCta();
    const title =
      payload?.title !== undefined
        ? normalizeString(payload.title)
        : existing?.title || "升级 Founder，解锁完整成长体系";
    const button_text =
      payload?.button_text !== undefined
        ? normalizeString(payload.button_text)
        : existing?.button_text || "立即升级";
    if (!title || !button_text) {
      throw new HomeServiceError("VALIDATION_ERROR", "title 与 button_text 不能为空");
    }

    await homeRepository.upsertMembershipCta({
      title,
      subtitle:
        payload?.subtitle !== undefined
          ? normalizeNullableString(payload.subtitle)
          : existing?.subtitle || null,
      button_text,
      button_link:
        payload?.button_link !== undefined
          ? normalizeNullableString(payload.button_link)
          : existing?.button_link || null,
      background_image_url:
        payload?.background_image_url !== undefined
          ? normalizeNullableString(payload.background_image_url)
          : existing?.background_image_url || null,
      status:
        payload?.status !== undefined
          ? normalizeStatus(payload.status, "active")
          : existing?.status || "active",
    });

    return this.getCmsMembershipCta();
  },
};
