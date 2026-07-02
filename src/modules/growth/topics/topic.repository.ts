import { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../../../db/index.js";

export type TopicRow = {
  id: number;
  name: string;
  slug: string;
  icon_url: string | null;
  sort_order: number;
  status: "active" | "inactive";
  article_count: number;
  created_at: Date;
  updated_at: Date;
};

type FindAllOptions = {
  status?: "active" | "inactive";
  keyword?: string;
};

type CreateTopicInput = {
  name: string;
  slug: string;
  icon_url: string | null;
  sort_order: number;
  status: "active" | "inactive";
};

type UpdateTopicInput = Partial<CreateTopicInput>;

type SortItem = {
  id: number;
  sort_order: number;
};

function mapTopicRow(row: RowDataPacket): TopicRow {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    icon_url: row.icon_url == null ? null : String(row.icon_url),
    sort_order: Number(row.sort_order || 0),
    status: row.status === "inactive" ? "inactive" : "active",
    article_count: Number(row.article_count || 0),
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export class TopicRepository {
  async findAll(options: FindAllOptions = {}): Promise<TopicRow[]> {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (options.status) {
      where.push("t.status = ?");
      params.push(options.status);
    }

    if (options.keyword) {
      where.push("(t.name LIKE ? OR t.slug LIKE ?)");
      const likeKeyword = `%${options.keyword}%`;
      params.push(likeKeyword, likeKeyword);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        t.id,
        t.name,
        t.slug,
        t.icon_url,
        t.sort_order,
        t.status,
        t.created_at,
        t.updated_at,
        COALESCE(COUNT(a.id), 0) AS article_count
      FROM topics t
      LEFT JOIN articles a ON a.topic_id = t.id
      ${whereSql}
      GROUP BY
        t.id, t.name, t.slug, t.icon_url, t.sort_order, t.status, t.created_at, t.updated_at
      ORDER BY t.sort_order ASC, t.id DESC
      `,
      params
    );

    return rows.map(mapTopicRow);
  }

  async findById(id: number): Promise<TopicRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT
        t.id,
        t.name,
        t.slug,
        t.icon_url,
        t.sort_order,
        t.status,
        t.created_at,
        t.updated_at,
        COALESCE(COUNT(a.id), 0) AS article_count
      FROM topics t
      LEFT JOIN articles a ON a.topic_id = t.id
      WHERE t.id = ?
      GROUP BY
        t.id, t.name, t.slug, t.icon_url, t.sort_order, t.status, t.created_at, t.updated_at
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) return null;
    return mapTopicRow(rows[0]);
  }

  async findByName(name: string): Promise<TopicRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, name, slug, icon_url, sort_order, status, article_count, created_at, updated_at
      FROM topics
      WHERE name = ?
      LIMIT 1
      `,
      [name]
    );

    if (rows.length === 0) return null;
    return mapTopicRow(rows[0]);
  }

  async findBySlug(slug: string): Promise<TopicRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, name, slug, icon_url, sort_order, status, article_count, created_at, updated_at
      FROM topics
      WHERE slug = ?
      LIMIT 1
      `,
      [slug]
    );

    if (rows.length === 0) return null;
    return mapTopicRow(rows[0]);
  }

  async create(payload: CreateTopicInput): Promise<TopicRow> {
    const [result] = await pool.query<ResultSetHeader>(
      `
      INSERT INTO topics (name, slug, icon_url, sort_order, status, article_count)
      VALUES (?, ?, ?, ?, ?, 0)
      `,
      [payload.name, payload.slug, payload.icon_url, payload.sort_order, payload.status]
    );

    const topic = await this.findById(Number(result.insertId));
    if (!topic) {
      throw new Error("Failed to load created topic");
    }
    return topic;
  }

  async update(id: number, payload: UpdateTopicInput): Promise<TopicRow | null> {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    if (payload.name !== undefined) {
      sets.push("name = ?");
      params.push(payload.name);
    }
    if (payload.slug !== undefined) {
      sets.push("slug = ?");
      params.push(payload.slug);
    }
    if (payload.icon_url !== undefined) {
      sets.push("icon_url = ?");
      params.push(payload.icon_url);
    }
    if (payload.sort_order !== undefined) {
      sets.push("sort_order = ?");
      params.push(payload.sort_order);
    }
    if (payload.status !== undefined) {
      sets.push("status = ?");
      params.push(payload.status);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE topics SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );
    }

    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM topics WHERE id = ?",
      [id]
    );
    return result.affectedRows > 0;
  }

  async updateSort(items: SortItem[]): Promise<void> {
    if (items.length === 0) return;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        await conn.query(
          "UPDATE topics SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
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

  async countArticles(id: number, connection?: PoolConnection): Promise<number> {
    const executor = connection ?? pool;
    const [rows] = await executor.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM articles WHERE topic_id = ?",
      [id]
    );
    return Number(rows[0]?.total || 0);
  }
}

export const topicRepository = new TopicRepository();
