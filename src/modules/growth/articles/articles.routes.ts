import { Router } from "express";
import {
  createCmsArticle,
  deleteCmsArticle,
  getAppArticleBySlug,
  getAppArticles,
  getCmsArticleById,
  getCmsArticles,
  postArticleLike,
  postArticleView,
  publishCmsArticle,
  updateCmsArticle,
} from "./articles.controller.js";

const articlesRouter = Router();
const cmsArticlesRouter = Router();

articlesRouter.get("/", getAppArticles);
articlesRouter.get("/:slug", getAppArticleBySlug);
articlesRouter.post("/:slug/view", postArticleView);
articlesRouter.post("/:slug/like", postArticleLike);

cmsArticlesRouter.get("/", getCmsArticles);
cmsArticlesRouter.get("/:id", getCmsArticleById);
cmsArticlesRouter.post("/", createCmsArticle);
cmsArticlesRouter.put("/:id", updateCmsArticle);
cmsArticlesRouter.delete("/:id", deleteCmsArticle);
cmsArticlesRouter.patch("/:id/publish", publishCmsArticle);

export { articlesRouter, cmsArticlesRouter };
