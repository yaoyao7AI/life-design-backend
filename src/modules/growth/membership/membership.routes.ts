import { Router } from "express";
import {
  getAppMembership,
  getCmsMembership,
} from "./membership.controller.js";

const membershipRouter = Router();
const cmsMembershipRouter = Router();

membershipRouter.get("/", getAppMembership);
cmsMembershipRouter.get("/", getCmsMembership);

export { membershipRouter, cmsMembershipRouter };
