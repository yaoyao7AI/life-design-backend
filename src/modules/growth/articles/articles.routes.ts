import { Router } from "express";
import { getAppArticles, getCmsArticles } from "./articles.controller.js";

const articlesRouter = Router();
const cmsArticlesRouter = Router();

articlesRouter.get("/", getAppArticles);
cmsArticlesRouter.get("/", getCmsArticles);

export { articlesRouter, cmsArticlesRouter };
