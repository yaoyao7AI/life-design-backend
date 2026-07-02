import { Request, Response } from "express";
import {
  getMembershipAppOverview,
  getMembershipCmsOverview,
} from "./membership.service.js";

export async function getCmsMembership(_req: Request, res: Response) {
  const payload = await getMembershipCmsOverview();
  return res.status(200).json({
    success: true,
    data: payload,
    message: "CMS membership mock response",
  });
}

export async function getAppMembership(_req: Request, res: Response) {
  const payload = await getMembershipAppOverview();
  return res.status(200).json({
    success: true,
    data: payload,
    message: "App membership mock response",
  });
}
