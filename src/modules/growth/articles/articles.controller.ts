import { Request, Response } from "express";
import { listArticlesApp, listArticlesCms } from "./articles.service.js";

export async function getCmsArticles(_req: Request, res: Response) {
  const items = await listArticlesCms();
  return res.status(200).json({
    success: true,
    data: { items },
    message: "CMS articles mock response",
  });
}

export async function getAppArticles(_req: Request, res: Response) {
  const items = await listArticlesApp();
  return res.status(200).json({
    success: true,
    data: { items },
    message: "App articles mock response",
  });
}
