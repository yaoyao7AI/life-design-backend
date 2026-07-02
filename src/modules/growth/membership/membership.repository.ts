import { randomUUID } from "node:crypto";
import { RowDataPacket } from "mysql2/promise";
import { pool } from "../../../db/index.js";

export type MembershipPlanRow = {
  id: string;
  code: string;
  name: string;
  tier: "free" | "founder";
  billing_cycle: string;
  price_cents: number;
  original_price_cents: number | null;
  benefits: unknown;
  status: "active" | "inactive";
  sort_order: number;
  created_at: Date;
};

export type UserMembershipRow = {
  id: string;
  user_id: string;
  tier: "free" | "founder";
  status: "active" | "expired" | "canceled";
  start_at: Date;
  end_at: Date | null;
  auto_renew: boolean;
  created_at: Date;
  updated_at: Date;
};

type CreateMembershipInput = {
  user_id: string;
  tier: "free" | "founder";
  status?: "active" | "expired" | "canceled";
  start_at: Date;
  end_at: Date | null;
  auto_renew: boolean;
};

type UpdateMembershipInput = Partial<{
  tier: "free" | "founder";
  status: "active" | "expired" | "canceled";
  start_at: Date;
  end_at: Date | null;
  auto_renew: boolean;
}>;

type UpdatePlanInput = Partial<{
  code: string;
  name: string;
  tier: "free" | "founder";
  billing_cycle: string;
  price_cents: number;
  original_price_cents: number | null;
  benefits: string | null;
  status: "active" | "inactive";
  sort_order: number;
}>;

function parseJsonOrNull(value: unknown) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function mapPlan(row: RowDataPacket): MembershipPlanRow {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    tier: row.tier === "founder" ? "founder" : "free",
    billing_cycle: String(row.billing_cycle),
    price_cents: Number(row.price_cents || 0),
    original_price_cents:
      row.original_price_cents == null ? null : Number(row.original_price_cents),
    benefits: parseJsonOrNull(row.benefits),
    status: row.status === "inactive" ? "inactive" : "active",
    sort_order: Number(row.sort_order || 0),
    created_at: new Date(row.created_at),
  };
}

function mapMembership(row: RowDataPacket): UserMembershipRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    tier: row.tier === "founder" ? "founder" : "free",
    status: row.status === "expired" || row.status === "canceled" ? row.status : "active",
    start_at: new Date(row.start_at),
    end_at: row.end_at ? new Date(row.end_at) : null,
    auto_renew: !!row.auto_renew,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export class MembershipRepository {
  async findPlans(): Promise<MembershipPlanRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, code, name, tier, billing_cycle, price_cents, original_price_cents,
             benefits, status, sort_order, created_at
      FROM membership_plans
      ORDER BY sort_order ASC, created_at ASC
      `
    );
    return rows.map(mapPlan);
  }

  async findPlanById(id: string): Promise<MembershipPlanRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, code, name, tier, billing_cycle, price_cents, original_price_cents,
             benefits, status, sort_order, created_at
      FROM membership_plans
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!rows.length) return null;
    return mapPlan(rows[0]);
  }

  async createPlan(input: {
    code: string;
    name: string;
    tier: "free" | "founder";
    billing_cycle: string;
    price_cents: number;
    original_price_cents: number | null;
    benefits: string | null;
    status: "active" | "inactive";
    sort_order: number;
  }) {
    const id = randomUUID();
    await pool.query(
      `
      INSERT INTO membership_plans (
        id, code, name, tier, billing_cycle, price_cents, original_price_cents,
        benefits, status, sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.code,
        input.name,
        input.tier,
        input.billing_cycle,
        input.price_cents,
        input.original_price_cents,
        input.benefits,
        input.status,
        input.sort_order,
      ]
    );
    return this.findPlanById(id);
  }

  async updatePlan(id: string, input: UpdatePlanInput) {
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    const append = (field: string, value: string | number | null | undefined) => {
      if (value === undefined) return;
      sets.push(`${field} = ?`);
      params.push(value);
    };

    append("code", input.code);
    append("name", input.name);
    append("tier", input.tier);
    append("billing_cycle", input.billing_cycle);
    append("price_cents", input.price_cents);
    append("original_price_cents", input.original_price_cents);
    append("benefits", input.benefits);
    append("status", input.status);
    append("sort_order", input.sort_order);

    if (sets.length > 0) {
      params.push(id);
      await pool.query(`UPDATE membership_plans SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    return this.findPlanById(id);
  }

  async findUserMembership(userId: string): Promise<UserMembershipRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, user_id, tier, status, start_at, end_at, auto_renew, created_at, updated_at
      FROM user_membership
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );
    if (!rows.length) return null;
    return mapMembership(rows[0]);
  }

  async findMembershipByUserId(userId: string): Promise<UserMembershipRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, user_id, tier, status, start_at, end_at, auto_renew, created_at, updated_at
      FROM user_membership
      WHERE user_id = ?
      ORDER BY created_at DESC
      `,
      [userId]
    );
    return rows.map(mapMembership);
  }

  async createMembership(input: CreateMembershipInput): Promise<UserMembershipRow | null> {
    const id = randomUUID();
    await pool.query(
      `
      INSERT INTO user_membership (
        id, user_id, tier, status, start_at, end_at, auto_renew
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        input.user_id,
        input.tier,
        input.status || "active",
        input.start_at,
        input.end_at,
        input.auto_renew ? 1 : 0,
      ]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, user_id, tier, status, start_at, end_at, auto_renew, created_at, updated_at
      FROM user_membership
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!rows.length) return null;
    return mapMembership(rows[0]);
  }

  async updateMembership(id: string, input: UpdateMembershipInput): Promise<UserMembershipRow | null> {
    const sets: string[] = [];
    const params: Array<string | number | Date | null> = [];

    const append = (field: string, value: string | number | Date | null | undefined) => {
      if (value === undefined) return;
      sets.push(`${field} = ?`);
      params.push(value);
    };

    append("tier", input.tier);
    append("status", input.status);
    append("start_at", input.start_at);
    append("end_at", input.end_at);
    if (input.auto_renew !== undefined) {
      append("auto_renew", input.auto_renew ? 1 : 0);
    }

    if (sets.length > 0) {
      params.push(id);
      await pool.query(
        `UPDATE user_membership SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        params
      );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, user_id, tier, status, start_at, end_at, auto_renew, created_at, updated_at
      FROM user_membership
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!rows.length) return null;
    return mapMembership(rows[0]);
  }

  async expireMembership(id: string): Promise<UserMembershipRow | null> {
    await pool.query(
      `
      UPDATE user_membership
      SET status = 'expired',
          end_at = COALESCE(end_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [id]
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT id, user_id, tier, status, start_at, end_at, auto_renew, created_at, updated_at
      FROM user_membership
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    if (!rows.length) return null;
    return mapMembership(rows[0]);
  }
}

export const membershipRepository = new MembershipRepository();
