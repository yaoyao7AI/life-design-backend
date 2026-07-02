import { Router } from "express";
import { jwtAuthStub } from "../middleware/jwt.js";
import {
  articlesRouter,
  cmsArticlesRouter,
} from "../modules/growth/articles/articles.routes.js";
import {
  topicsRouter,
  cmsTopicsRouter,
} from "../modules/growth/topics/topics.routes.js";
import {
  membershipRouter,
  cmsMembershipRouter,
} from "../modules/growth/membership/membership.routes.js";

const rootRouter = Router();

rootRouter.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: { status: "ok" },
    message: "",
  });
});

rootRouter.use("/api/growth/articles", articlesRouter);
rootRouter.use("/api/growth/topics", topicsRouter);
rootRouter.use("/api/growth/membership", jwtAuthStub, membershipRouter);

rootRouter.use("/api/growth/cms/articles", jwtAuthStub, cmsArticlesRouter);
rootRouter.use("/api/growth/cms/topics", jwtAuthStub, cmsTopicsRouter);
rootRouter.use("/api/growth/cms/membership", jwtAuthStub, cmsMembershipRouter);

export default rootRouter;
