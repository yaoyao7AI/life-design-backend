import { randomUUID } from "node:crypto";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../../db/index.js";

export type ArticleRow = {
  id: string;
  title: string;
  title_en: string | null;
  slug: string;
  topic_id: number | null;
  topic_name: string | null;
  content: unknown;
  status: "draft" | "published" | "archived";
  visibility: "public" | "members_only";
  membership_tier: "free" | "founder";
  cover_url: string | null;
  views: number;
  likes: number;
  reading_time_minutes: number;
  author_id: string;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

type FindListOptions = {
  page: number;
  page_size: number;
  keyword?: string;
  topic_id?: number;
  status?: "draft" | "published" | "archived";
  sort?: "published_desc" | "published_asc" | "created_desc";
  app_mode?: boolean;
};

type CreateArticleInput = {
  title: string;
  title_en: string | null;
  slug: string;
  topic_id: number | null;
  content: string;
  status: "draft" | "published" | "archived";
  visibility: "public" | "members_only";
  membership_tier: "free" | "founder";
  cover_url: string | null;
  reading_time_minutes: number;
  author_id: string;
  published_at: Date | null;
};

type UpdateArticleInput = Partial<CreateArticleInput>;

type FindListResult = {
  items: ArticleRow[];
  total: number;
  page: number;
  page_size: number;
};

function parseJsonOrNull(value: unknown) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function mapArticleRow(row: RowDataPacket): ArticleRow {
  return {
    id: String(row.id),
    title: String(row.title),
    title_en: row.title_en == null ? null : String(row.title_en),
    slug: String(row.slug),
    topic_id: row.topic_id == null ? null : Number(row.topic_id),
    topic_name: row.topic_name == null ? null : String(row.topic_name),
    content: parseJsonOrNull(row.content),
    status: (row.status as ArticleRow["status"]) || "draft",
    visibility: (row.visibility as ArticleRow["visibility"]) || "public",
    membership_tier: (row.membership_tier as ArticleRow["membership_tier"]) || "free",
    cover_url: row.cover_url == null ? null : String(row.cover_url),
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    reading_time_minutes: Number(row.reading_time_minutes || 0),
    author_id: String(row.author_id),
    published_at: row.published_at ? new Date(row.published_at) : null,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

function resolveOrderBy(sort: FindListOptions["sort"]) {
  if (sort === "published_asc") return "a.published_at ASC, a.id DESC";
  if (sort === "created_desc") return "a.created_at DESC, a.id DESC";
  return "a.published_at DESC, a.id DESC";
}

async function refreshTopicArticleCount(topicId: number | null) {
  if (!topicId) return;
  await pool.query(
    `
    UPDATE topics t
    SET article_count = (
      SELECT COUNT(*)
      FROM articles a
      WHERE a.topic_id = t.id
    )
    WHERE t.id = ?
    `,
    [topicId]
  );
}

export class ArticleRepository {
  async findList(options: FindListOptions): Promise<FindListResult> {
    const where: string[] = [];
    const whereParams: Array<string | number> = [];
    const page = options.page;
    const pageSize = options.page_size;
    const offset = (page - 1) * pageSize;

    if (options.app_mode) {
      where.push("a.status = 'published'");
    } else if (options.status) {
      where.push("a.status = ?");
      whereParams.push(options.status);
    }

    if (options.keyword) {
      where.push("(a.title LIKE ? OR a.title_en LIKE ? OR a.slug LIKE ?)");
      const keyword = `%${options.keyword}%`;
      whereParams.push(keyword, keyword, keyword);
    }

    if (options.topic_id) {
      where.push("a.topic_id = ?");
      whereParams.push(options.topic_id);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM articles a ${whereSql}`,
      whereParams
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        a.id, a.title, a.title_en, a.slug, a.topic_id, a.content, a.status,
        a.visibility, a.membership_tier, a.cover_url, a.views, a.likes,
        a.reading_time_minutes, a.author_id, a.published_at, a.created_at, a.updated_at,
        t.name AS topic_name
      FROM articles a
      LEFT JOIN topics t ON t.id = a.topic_id
      ${whereSql}
      ORDER BY ${resolveOrderBy(options.sort)}
      LIMIT ? OFFSET ?
      `,
      [...whereParams, pageSize, offset]
    );

    return {
      items: rows.map(mapArticleRow),
      total,
      page,
      page_size: pageSize,
    };
  }

  async findById(id: string): Promise<ArticleRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        a.id, a.title, a.title_en, a.slug, a.topic_id, a.content, a.status,
        a.visibility, a.membership_tier, a.cover_url, a.views, a.likes,
        a.reading_time_minutes, a.author_id, a.published_at, a.created_at, a.updated_at,
        t.name AS topic_name
      FROM articles a
      LEFT JOIN topics t ON t.id = a.topic_id
      WHERE a.id = ?
      LIMIT 1
      `,
      [id]
    );
    if (rows.length === 0) return null;
    return mapArticleRow(rows[0]);
  }

  async findBySlug(slug: string, appMode = false): Promise<ArticleRow | null> {
    const appFilter = appMode ? "AND a.status = 'published'" : "";
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        a.id, a.title, a.title_en, a.slug, a.topic_id, a.content, a.status,
        a.visibility, a.membership_tier, a.cover_url, a.views, a.likes,
        a.reading_time_minutes, a.author_id, a.published_at, a.created_at, a.updated_at,
        t.name AS topic_name
      FROM articles a
      LEFT JOIN topics t ON t.id = a.topic_id
      WHERE a.slug = ?
      ${appFilter}
      LIMIT 1
      `,
      [slug]
    );
    if (rows.length === 0) return null;
    return mapArticleRow(rows[0]);
  }

  async create(payload: CreateArticleInput): Promise<ArticleRow> {
    const id = randomUUID();
    await pool.query(
      `
      INSERT INTO articles (
        id, title, title_en, slug, topic_id, content, status, visibility, membership_tier,
        cover_url, views, likes, reading_time_minutes, author_id, published_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
      `,
      [
        id,
        payload.title,
        payload.title_en,
        payload.slug,
        payload.topic_id,
        payload.content,
        payload.status,
        payload.visibility,
        payload.membership_tier,
        payload.cover_url,
        payload.reading_time_minutes,
        payload.author_id,
        payload.published_at,
      ]
    );

    await refreshTopicArticleCount(payload.topic_id);
    const article = await this.findById(id);
    if (!article) throw new Error("Failed to load created article");
    return article;
  }

  async update(id: string, payload: UpdateArticleInput): Promise<ArticleRow | null> {
    const before = await this.findById(id);
    if (!before) return null;

    const sets: string[] = [];
    const params: Array<string | number | null | Date> = [];

    if (payload.title !== undefined) {
      sets.push("title = ?");
      params.push(payload.title);
    }
    if (payload.title_en !== undefined) {
      sets.push("title_en = ?");
      params.push(payload.title_en);
    }
    if (payload.slug !== undefined) {
      sets.push("slug = ?");
      params.push(payload.slug);
    }
    if (payload.topic_id !== undefined) {
      sets.push("topic_id = ?");
      params.push(payload.topic_id);
    }
    if (payload.content !== undefined) {
      sets.push("content = ?");
      params.push(payload.content);
    }
    if (payload.status !== undefined) {
      sets.push("status = ?");
      params.push(payload.status);
    }
    if (payload.visibility !== undefined) {
      sets.push("visibility = ?");
      params.push(payload.visibility);
    }
    if (payload.membership_tier !== undefined) {
      sets.push("membership_tier = ?");
      params.push(payload.membership_tier);
    }
    if (payload.cover_url !== undefined) {
      sets.push("cover_url = ?");
      params.push(payload.cover_url);
    }
    if (payload.reading_time_minutes !== undefined) {
      sets.push("reading_time_minutes = ?");
      params.push(payload.reading_time_minutes);
    }
    if (payload.author_id !== undefined) {
      sets.push("author_id = ?");
      params.push(payload.author_id);
    }
    if (payload.published_at !== undefined) {
      sets.push("published_at = ?");
      params.push(payload.published_at);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE articles SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );
    }

    const after = await this.findById(id);
    await refreshTopicArticleCount(before.topic_id);
    await refreshTopicArticleCount(after?.topic_id ?? null);
    return after;
  }

  async delete(id: string): Promise<boolean> {
    const article = await this.findById(id);
    if (!article) return false;
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM articles WHERE id = ?",
      [id]
    );
    await refreshTopicArticleCount(article.topic_id);
    return result.affectedRows > 0;
  }

  async publish(id: string): Promise<ArticleRow | null> {
    await pool.query(
      `
      UPDATE articles
      SET status = 'published',
          published_at = COALESCE(published_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [id]
    );
    return this.findById(id);
  }

  async incrementView(id: string): Promise<number> {
    await pool.query(
      "UPDATE articles SET views = views + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT views FROM articles WHERE id = ? LIMIT 1",
      [id]
    );
    return Number(rows[0]?.views || 0);
  }

  async incrementLike(id: string): Promise<number> {
    await pool.query(
      "UPDATE articles SET likes = likes + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT likes FROM articles WHERE id = ? LIMIT 1",
      [id]
    );
    return Number(rows[0]?.likes || 0);
  }
}

export const articleRepository = new ArticleRepository();
