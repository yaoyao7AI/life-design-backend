import { Request, Response } from "express";
import { topicService, TopicServiceError } from "./topics.service.js";

function handleControllerError(res: Response, error: unknown) {
  if (error instanceof TopicServiceError) {
    return res.status(error.status).json({
      success: false,
      error_code: error.code,
      message: error.message,
    });
  }

  console.error("[topics-controller]", error);
  return res.status(500).json({
    success: false,
    error_code: "INTERNAL_ERROR",
    message: "服务器内部错误",
  });
}

export async function getCmsTopics(req: Request, res: Response) {
  try {
    const items = await topicService.findAllCms({
      keyword: req.query.keyword ? String(req.query.keyword) : undefined,
      status: req.query.status ? String(req.query.status).toLowerCase() as "active" | "inactive" : undefined,
    });
    return res.status(200).json({
      success: true,
      data: { items },
      message: "ok",
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

export async function getAppTopics(_req: Request, res: Response) {
  try {
    const items = await topicService.findAllApp();
    return res.status(200).json({
      success: true,
      data: { items },
      message: "ok",
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

export async function createTopic(req: Request, res: Response) {
  try {
    const data = await topicService.create(req.body || {});
    return res.status(201).json({
      success: true,
      data,
      message: "Topic 创建成功",
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

export async function updateTopic(req: Request, res: Response) {
  try {
    const data = await topicService.update(req.params.id, req.body || {});
    return res.status(200).json({
      success: true,
      data,
      message: "Topic 更新成功",
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

export async function deleteTopic(req: Request, res: Response) {
  try {
    const data = await topicService.delete(req.params.id);
    return res.status(200).json({
      success: true,
      data,
      message: "Topic 删除成功",
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}

export async function updateTopicSort(req: Request, res: Response) {
  try {
    const data = await topicService.updateSort(req.body || {});
    return res.status(200).json({
      success: true,
      data,
      message: "Topic 排序更新成功",
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
}
