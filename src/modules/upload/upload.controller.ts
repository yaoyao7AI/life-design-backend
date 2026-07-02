import fs from "node:fs";
import { Request, Response } from "express";
import {
  buildUploadStorage,
  uploadService,
  UploadServiceError,
} from "./upload.service.js";

function buildAbsoluteUrl(req: Request, relativeUrl: string) {
  return `${req.protocol}://${req.get("host")}${relativeUrl}`;
}

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({
    success: false,
    error_code: code,
    message,
  });
}

function handleUploadError(res: Response, error: unknown) {
  if (error instanceof UploadServiceError) {
    return fail(res, error.status, error.code, error.message);
  }
  console.error("[upload-controller]", error);
  return fail(res, 500, "INTERNAL_ERROR", "服务器内部错误");
}

async function persistUploadedFile(req: Request, file: Express.Multer.File) {
  const meta = buildUploadStorage(file);
  fs.renameSync(file.path, meta.absolute_path);

  const createdBy =
    (typeof req.body?.created_by === "string" && req.body.created_by.trim()) ||
    (typeof req.headers["x-user-id"] === "string" && req.headers["x-user-id"].trim()) ||
    null;

  return uploadService.createUploadRecord({
    file,
    fileId: meta.id,
    fileName: meta.file_name,
    storagePath: meta.storage_path,
    absolutePath: meta.absolute_path,
    url: buildAbsoluteUrl(req, meta.relative_url),
    createdBy,
  });
}

export async function uploadSingleImage(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file) {
      return fail(res, 400, "FILE_REQUIRED", "请上传图片文件");
    }
    const data = await persistUploadedFile(req, file);
    return res.status(200).json({
      success: true,
      data,
      message: "上传成功",
    });
  } catch (error) {
    return handleUploadError(res, error);
  }
}

export async function uploadMultipleImages(req: Request, res: Response) {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!Array.isArray(files) || files.length === 0) {
      return fail(res, 400, "FILE_REQUIRED", "请上传至少一张图片");
    }

    const items = [];
    for (const file of files) {
      // 顺序执行，便于定位单张失败并维持实现简洁
      const saved = await persistUploadedFile(req, file);
      items.push(saved);
    }

    return res.status(200).json({
      success: true,
      data: { items },
      message: "上传成功",
    });
  } catch (error) {
    return handleUploadError(res, error);
  }
}

export async function getUploadById(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return fail(res, 400, "VALIDATION_ERROR", "id 不能为空");

    const data = await uploadService.getById(id);
    if (!data) return fail(res, 404, "UPLOAD_NOT_FOUND", "上传文件不存在");

    return res.status(200).json({
      success: true,
      data,
      message: "ok",
    });
  } catch (error) {
    return handleUploadError(res, error);
  }
}

export async function deleteUploadById(req: Request, res: Response) {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) return fail(res, 400, "VALIDATION_ERROR", "id 不能为空");

    const data = await uploadService.deleteById(id);
    if (!data.deleted) return fail(res, 404, "UPLOAD_NOT_FOUND", "上传文件不存在");

    return res.status(200).json({
      success: true,
      data,
      message: "删除成功",
    });
  } catch (error) {
    return handleUploadError(res, error);
  }
}
