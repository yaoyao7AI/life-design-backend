import { Request, Response } from "express";
import { membershipService, MembershipServiceError } from "./membership.service.js";

function handleMembershipError(res: Response, error: unknown) {
  if (error instanceof MembershipServiceError) {
    return res.status(error.status).json({
      success: false,
      error_code: error.code,
      message: error.message,
    });
  }
  console.error("[membership-controller]", error);
  return res.status(500).json({
    success: false,
    error_code: "INTERNAL_ERROR",
    message: "服务器内部错误",
  });
}

function readUserId(req: Request) {
  return (
    (typeof req.query.user_id === "string" && req.query.user_id) ||
    (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"]) ||
    (typeof req.body?.user_id === "string" && req.body.user_id) ||
    ""
  );
}

export async function getCmsMembershipPlans(_req: Request, res: Response) {
  try {
    const data = await membershipService.getPlans();
    return res.status(200).json({ success: true, data: { plans: data }, message: "ok" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}

export async function createCmsMembershipPlan(req: Request, res: Response) {
  try {
    const data = await membershipService.createPlan(req.body || {});
    return res.status(201).json({ success: true, data, message: "套餐创建成功" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}

export async function updateCmsMembershipPlan(req: Request, res: Response) {
  try {
    const data = await membershipService.updatePlan(String(req.params.id || ""), req.body || {});
    return res.status(200).json({ success: true, data, message: "套餐更新成功" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}

export async function getAppMembershipPlans(_req: Request, res: Response) {
  try {
    const data = await membershipService.getPlans();
    return res.status(200).json({ success: true, data: { plans: data }, message: "ok" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}

export async function getAppMembershipMe(req: Request, res: Response) {
  try {
    const userId = readUserId(req);
    const data = await membershipService.getCurrentMembership(userId);
    return res.status(200).json({ success: true, data, message: "ok" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}

export async function postAppMembershipAccessCheck(req: Request, res: Response) {
  try {
    const data = await membershipService.accessCheck({
      ...(req.body || {}),
      user_id: readUserId(req),
    });
    return res.status(200).json({ success: true, data, message: "ok" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}

export async function createCmsUserMembership(req: Request, res: Response) {
  try {
    const data = await membershipService.createMembership(req.body || {});
    return res.status(201).json({ success: true, data, message: "会员创建成功" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}

export async function updateCmsUserMembership(req: Request, res: Response) {
  try {
    const data = await membershipService.updateMembership(String(req.params.id || ""), req.body || {});
    return res.status(200).json({ success: true, data, message: "会员更新成功" });
  } catch (error) {
    return handleMembershipError(res, error);
  }
}
