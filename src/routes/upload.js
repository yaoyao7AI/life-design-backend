import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";
import { resolvePublicUploadUrl } from "../utils/publicUploadUrl.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保上传目录存在
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 配置存储策略
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.userId;
    const type = req.body.type;
    
    let uploadPath = path.join(uploadsDir, String(userId));
    
    if (type === "vision-image" || type === "vision-cover") {
      const boardId = req.body.board_id;
      if (!boardId) {
        return cb(new Error("愿景板图片需要提供 board_id"));
      }
      uploadPath = path.join(uploadPath, String(boardId));
    }

    if (type === "todo-image" || type === "todo-video") {
      const todoId = req.body.todo_id;
      uploadPath = path.join(uploadPath, "todos");
      if (todoId) {
        uploadPath = path.join(uploadPath, String(todoId));
      }
    }
    
    // 确保目录存在
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const type = req.body.type;
    let filename;
    
    if (type === "avatar") {
      const ext = path.extname(file.originalname);
      filename = `avatar${ext}`;
    } else if (type === "vision-cover") {
      filename = "cover.jpg";
    } else {
      // vision-image / todo-image / todo-video
      const ext = path.extname(file.originalname) || ".bin";
      filename = `${Date.now()}${ext}`;
    }
    
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const type = req.body.type;
  // 允许图片 & 视频（最终以 handler 中的 type 校验为准）
  const allowedImageMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedVideoMimes = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v"
  ];
  
  if (allowedImageMimes.includes(file.mimetype)) return cb(null, true);
  if (allowedVideoMimes.includes(file.mimetype)) return cb(null, true);
  return cb(new Error("仅支持图片/视频文件（JPEG、PNG、WebP、GIF、MP4、WebM、MOV、M4V）"));
};

// 配置 multer
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB（兼容 todo-video）
  },
  fileFilter
});

/**
 * 文件上传接口
 * POST /api/upload
 */
router.post(
  "/",
  authenticateToken,
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "未上传文件"
        });
      }

      const type = req.body.type;
      if (
        !type ||
        !["avatar", "vision-image", "vision-cover", "todo-image", "todo-video"].includes(type)
      ) {
        // 删除已上传的文件
        if (req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          error: "无效的文件类型"
        });
      }

      // 进一步校验：todo-video 必须是视频 MIME；其它类型必须是图片 MIME
      if (type === "todo-video" && !String(req.file.mimetype || "").startsWith("video/")) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: "todo-video 必须上传视频文件" });
      }
      if (type !== "todo-video" && !String(req.file.mimetype || "").startsWith("image/")) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: "该类型必须上传图片文件" });
      }

      // 构建公开可访问的 URL
      // 相对路径：uploads/userId/... 或 uploads/userId/boardId/...
      const relativePath = req.file.path.replace(uploadsDir + path.sep, "").replace(/\\/g, "/");
      const publicUrl = resolvePublicUploadUrl(relativePath, req);

      res.json({ url: publicUrl });
    } catch (error) {
      console.error("[文件上传错误]", error);
      
      // 如果文件已上传但处理失败，删除文件
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error("[删除文件失败]", unlinkError);
        }
      }
      
      res.status(500).json({
        success: false,
        error: "文件上传失败",
        message: error.message
      });
    }
  }
);

// 错误处理中间件
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "文件大小超过限制",
        message: "文件大小不能超过 50MB"
      });
    }
    return res.status(400).json({
      success: false,
      error: "文件上传失败",
      message: error.message
    });
  }
  
  res.status(400).json({
    success: false,
    error: "文件上传失败",
    message: error.message
  });
});

export default router;



