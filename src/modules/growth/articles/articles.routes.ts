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
const UUID_V4_LIKE_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

articlesRouter.get("/", getAppArticles);
articlesRouter.get("/:id", (req, res, next) => {
  const id = String(req.params.id || "");
  if (!UUID_V4_LIKE_RE.test(id)) return next();
  return getCmsArticleById(req, res);
});
articlesRouter.get("/:slug", getAppArticleBySlug);
articlesRouter.post("/:slug/view", postArticleView);
articlesRouter.post("/:slug/like", postArticleLike);
articlesRouter.post("/", createCmsArticle);
articlesRouter.put("/:id", updateCmsArticle);
articlesRouter.delete("/:id", deleteCmsArticle);
articlesRouter.patch("/:id/publish", publishCmsArticle);

cmsArticlesRouter.get("/", getCmsArticles);
cmsArticlesRouter.get("/:id", getCmsArticleById);
cmsArticlesRouter.post("/", createCmsArticle);
cmsArticlesRouter.put("/:id", updateCmsArticle);
cmsArticlesRouter.delete("/:id", deleteCmsArticle);
cmsArticlesRouter.patch("/:id/publish", publishCmsArticle);

export { articlesRouter, cmsArticlesRouter };
