import { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../db/index.js";

export type HomeStatus = "active" | "inactive";
export type HomeSectionKey = "most_popular" | "latest";

export type HomeBannerRow = {
  id: number;
  title: string;
  image_url: string;
  link_url: string | null;
  status: HomeStatus;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type HomeCourseRow = {
  id: number;
  title: string;
  subtitle: string | null;
  cover_url: string;
  link_url: string | null;
  status: HomeStatus;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type HomeSectionRow = {
  id: number;
  section_key: HomeSectionKey;
  title: string;
  subtitle: string | null;
  article_limit: number;
  article_ids: string[];
  status: HomeStatus;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type MembershipCtaRow = {
  id: number;
  title: string;
  subtitle: string | null;
  button_text: string;
  button_link: string | null;
  background_image_url: string | null;
  status: HomeStatus;
  created_at: Date;
  updated_at: Date;
};

function mapBanner(row: RowDataPacket): HomeBannerRow {
  return {
    id: Number(row.id),
    title: String(row.title),
    image_url: String(row.image_url),
    link_url: row.link_url == null ? null : String(row.link_url),
    status: row.status === "inactive" ? "inactive" : "active",
    sort_order: Number(row.sort_order || 0),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function mapCourse(row: RowDataPacket): HomeCourseRow {
  return {
    id: Number(row.id),
    title: String(row.title),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    cover_url: String(row.cover_url),
    link_url: row.link_url == null ? null : String(row.link_url),
    status: row.status === "inactive" ? "inactive" : "active",
    sort_order: Number(row.sort_order || 0),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function parseArticleIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function mapSection(row: RowDataPacket): HomeSectionRow {
  return {
    id: Number(row.id),
    section_key: row.section_key === "latest" ? "latest" : "most_popular",
    title: String(row.title),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    article_limit: Number(row.article_limit || 0),
    article_ids: parseArticleIds(row.article_ids),
    status: row.status === "inactive" ? "inactive" : "active",
    sort_order: Number(row.sort_order || 0),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function mapCta(row: RowDataPacket): MembershipCtaRow {
  return {
    id: Number(row.id),
    title: String(row.title),
    subtitle: row.subtitle == null ? null : String(row.subtitle),
    button_text: String(row.button_text),
    button_link: row.button_link == null ? null : String(row.button_link),
    background_image_url:
      row.background_image_url == null ? null : String(row.background_image_url),
    status: row.status === "inactive" ? "inactive" : "active",
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export class HomeRepository {
  async findBanners(activeOnly: boolean): Promise<HomeBannerRow[]> {
    const where = activeOnly ? "WHERE status = 'active'" : "";
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, title, image_url, link_url, status, sort_order, created_at, updated_at
      FROM home_banners
      ${where}
      ORDER BY sort_order ASC, id DESC
      `
    );
    return rows.map(mapBanner);
  }

  async createBanner(payload: {
    title: string;
    image_url: string;
    link_url: string | null;
    status: HomeStatus;
    sort_order: number;
  }) {
    await pool.query(
      `
      INSERT INTO home_banners (title, image_url, link_url, status, sort_order)
      VALUES (?, ?, ?, ?, ?)
      `,
      [payload.title, payload.image_url, payload.link_url, payload.status, payload.sort_order]
    );
  }

  async updateBanner(id: number, payload: {
    title?: string;
    image_url?: string;
    link_url?: string | null;
    status?: HomeStatus;
    sort_order?: number;
  }) {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    const add = (field: string, value: string | number | null | undefined) => {
      if (value === undefined) return;
      sets.push(`${field} = ?`);
      params.push(value);
    };

    add("title", payload.title);
    add("image_url", payload.image_url);
    add("link_url", payload.link_url);
    add("status", payload.status);
    add("sort_order", payload.sort_order);

    if (sets.length === 0) return;
    params.push(id);
    await pool.query(
      `UPDATE home_banners SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
  }

  async deleteBanner(id: number) {
    const [result] = await pool.query("DELETE FROM home_banners WHERE id = ?", [id]);
    return Number((result as any)?.affectedRows || 0) > 0;
  }

  async updateBannerSort(items: Array<{ id: number; sort_order: number }>) {
    if (items.length === 0) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        await conn.query(
          "UPDATE home_banners SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [item.sort_order, item.id]
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async findSection(sectionKey: HomeSectionKey): Promise<HomeSectionRow | null> {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT id, section_key, title, subtitle, article_limit, article_ids, status, sort_order, created_at, updated_at
        FROM home_sections
        WHERE section_key = ?
        LIMIT 1
        `,
        [sectionKey]
      );
      if (!rows.length) return null;
      return mapSection(rows[0]);
    } catch (error: any) {
      // 兼容尚未补齐 article_ids 列的旧库
      if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT id, section_key, title, subtitle, article_limit, status, sort_order, created_at, updated_at
        FROM home_sections
        WHERE section_key = ?
        LIMIT 1
        `,
        [sectionKey]
      );
      if (!rows.length) return null;
      return mapSection(rows[0]);
    }
  }

  async upsertSection(sectionKey: HomeSectionKey, payload: {
    title: string;
    subtitle: string | null;
    article_limit: number;
    article_ids: string[];
    status: HomeStatus;
    sort_order: number;
  }) {
    const articleIdsJson = JSON.stringify(payload.article_ids || []);
    const runUpsert = async () => {
      await pool.query(
        `
        INSERT INTO home_sections (section_key, title, subtitle, article_limit, article_ids, status, sort_order)
        VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?)
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          subtitle = VALUES(subtitle),
          article_limit = VALUES(article_limit),
          article_ids = VALUES(article_ids),
          status = VALUES(status),
          sort_order = VALUES(sort_order),
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          sectionKey,
          payload.title,
          payload.subtitle,
          payload.article_limit,
          articleIdsJson,
          payload.status,
          payload.sort_order,
        ]
      );
    };

    try {
      await runUpsert();
    } catch (error: any) {
      if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
      await pool.query(
        `ALTER TABLE home_sections ADD COLUMN article_ids JSON NULL AFTER article_limit`
      );
      await runUpsert();
    }
  }

  async findCourses(activeOnly: boolean): Promise<HomeCourseRow[]> {
    const where = activeOnly ? "WHERE status = 'active'" : "";
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, title, subtitle, cover_url, link_url, status, sort_order, created_at, updated_at
      FROM home_courses
      ${where}
      ORDER BY sort_order ASC, id DESC
      `
    );
    return rows.map(mapCourse);
  }

  async createCourse(payload: {
    title: string;
    subtitle: string | null;
    cover_url: string;
    link_url: string | null;
    status: HomeStatus;
    sort_order: number;
  }) {
    await pool.query(
      `
      INSERT INTO home_courses (title, subtitle, cover_url, link_url, status, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payload.title,
        payload.subtitle,
        payload.cover_url,
        payload.link_url,
        payload.status,
        payload.sort_order,
      ]
    );
  }

  async updateCourse(id: number, payload: {
    title?: string;
    subtitle?: string | null;
    cover_url?: string;
    link_url?: string | null;
    status?: HomeStatus;
    sort_order?: number;
  }) {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    const add = (field: string, value: string | number | null | undefined) => {
      if (value === undefined) return;
      sets.push(`${field} = ?`);
      params.push(value);
    };

    add("title", payload.title);
    add("subtitle", payload.subtitle);
    add("cover_url", payload.cover_url);
    add("link_url", payload.link_url);
    add("status", payload.status);
    add("sort_order", payload.sort_order);

    if (sets.length === 0) return;
    params.push(id);
    await pool.query(
      `UPDATE home_courses SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
  }

  async deleteCourse(id: number) {
    const [result] = await pool.query("DELETE FROM home_courses WHERE id = ?", [id]);
    return Number((result as any)?.affectedRows || 0) > 0;
  }

  async updateCourseSort(items: Array<{ id: number; sort_order: number }>) {
    if (items.length === 0) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        await conn.query(
          "UPDATE home_courses SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [item.sort_order, item.id]
        );
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  async getMembershipCta(): Promise<MembershipCtaRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, title, subtitle, button_text, button_link, background_image_url, status, created_at, updated_at
      FROM membership_cta
      ORDER BY id ASC
      LIMIT 1
      `
    );
    if (!rows.length) return null;
    return mapCta(rows[0]);
  }

  async upsertMembershipCta(payload: {
    title: string;
    subtitle: string | null;
    button_text: string;
    button_link: string | null;
    background_image_url: string | null;
    status: HomeStatus;
  }) {
    await pool.query(
      `
      INSERT INTO membership_cta (
        id, title, subtitle, button_text, button_link, background_image_url, status
      )
      VALUES (1, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        subtitle = VALUES(subtitle),
        button_text = VALUES(button_text),
        button_link = VALUES(button_link),
        background_image_url = VALUES(background_image_url),
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        payload.title,
        payload.subtitle,
        payload.button_text,
        payload.button_link,
        payload.background_image_url,
        payload.status,
      ]
    );
  }
}

export const homeRepository = new HomeRepository();
