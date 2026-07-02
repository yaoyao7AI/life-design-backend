import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import {
  deleteUploadById,
  getUploadById,
  uploadMultipleImages,
  uploadSingleImage,
} from "./upload.controller.js";
import { MAX_UPLOAD_SIZE_BYTES, UploadServiceError } from "./upload.service.js";

const router = Router();

const tempDir = path.join(process.cwd(), "uploads", ".tmp");
fs.mkdirSync(tempDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tempDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES,
  },
});

function handleMulterError(
  err: unknown,
  _req: any,
  res: any,
  next: any
) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        success: false,
        error_code: "FILE_TOO_LARGE",
        message: "图片大小不能超过 10MB",
      });
    }
    return res.status(400).json({
      success: false,
      error_code: "UPLOAD_ERROR",
      message: err.message,
    });
  }

  if (err instanceof UploadServiceError) {
    return res.status(err.status).json({
      success: false,
      error_code: err.code,
      message: err.message,
    });
  }

  return next(err);
}

router.post("/image", upload.single("file"), uploadSingleImage, handleMulterError);
router.post("/images", upload.array("files", 20), uploadMultipleImages, handleMulterError);
router.get("/:id", getUploadById);
router.delete("/:id", deleteUploadById);

export default router;
