import { Request, Response } from "express";
import { articleService, ArticleServiceError } from "./articles.service.js";

function handleArticleError(res: Response, error: unknown) {
  if (error instanceof ArticleServiceError) {
    return res.status(error.status).json({
      success: false,
      error_code: error.code,
      message: error.message,
    });
  }
  console.error("[articles-controller]", error);
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
    ""
  );
}

export async function getCmsArticles(req: Request, res: Response) {
  try {
    const data = await articleService.findCmsList(req.query || {});
    return res.status(200).json({ success: true, data, message: "ok" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function getCmsArticleById(req: Request, res: Response) {
  try {
    const data = await articleService.findById(String(req.params.id || ""));
    return res.status(200).json({ success: true, data, message: "ok" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function createCmsArticle(req: Request, res: Response) {
  try {
    const data = await articleService.create(req.body || {});
    return res.status(201).json({ success: true, data, message: "文章创建成功" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function updateCmsArticle(req: Request, res: Response) {
  try {
    const data = await articleService.update(String(req.params.id || ""), req.body || {});
    return res.status(200).json({ success: true, data, message: "文章更新成功" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function deleteCmsArticle(req: Request, res: Response) {
  try {
    const data = await articleService.remove(String(req.params.id || ""));
    return res.status(200).json({ success: true, data, message: "文章删除成功" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function publishCmsArticle(req: Request, res: Response) {
  try {
    const data = await articleService.publish(String(req.params.id || ""));
    return res.status(200).json({ success: true, data, message: "文章发布成功" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function getAppArticles(req: Request, res: Response) {
  try {
    const data = await articleService.findAppList({
      ...(req.query || {}),
      user_id: readUserId(req),
    });
    return res.status(200).json({ success: true, data, message: "ok" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function getAppArticleBySlug(req: Request, res: Response) {
  try {
    const data = await articleService.findBySlug(
      String(req.params.slug || ""),
      readUserId(req)
    );
    return res.status(200).json({ success: true, data, message: "ok" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function postArticleView(req: Request, res: Response) {
  try {
    const data = await articleService.incrementView(String(req.params.slug || ""));
    return res.status(200).json({ success: true, data, message: "阅读量更新成功" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}

export async function postArticleLike(req: Request, res: Response) {
  try {
    const data = await articleService.incrementLike(String(req.params.slug || ""));
    return res.status(200).json({ success: true, data, message: "点赞数更新成功" });
  } catch (error) {
    return handleArticleError(res, error);
  }
}
