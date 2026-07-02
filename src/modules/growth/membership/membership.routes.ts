import { Router } from "express";
import {
  createCmsMembershipPlan,
  createCmsUserMembership,
  getAppMembershipMe,
  getAppMembershipPlans,
  getCmsMembershipPlans,
  postAppMembershipAccessCheck,
  updateCmsMembershipPlan,
  updateCmsUserMembership,
} from "./membership.controller.js";

const membershipRouter = Router();
const cmsMembershipRouter = Router();

membershipRouter.get("/plans", getAppMembershipPlans);
membershipRouter.get("/me", getAppMembershipMe);
membershipRouter.post("/access-check", postAppMembershipAccessCheck);

cmsMembershipRouter.get("/", getCmsMembershipPlans);
cmsMembershipRouter.post("/", createCmsMembershipPlan);
cmsMembershipRouter.put("/:id", updateCmsMembershipPlan);
cmsMembershipRouter.post("/user-membership", createCmsUserMembership);
cmsMembershipRouter.put("/user-membership/:id", updateCmsUserMembership);

export { membershipRouter, cmsMembershipRouter };
