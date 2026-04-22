import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "url";
import { authenticateToken } from "../middleware/auth.js";
import { pool } from "../db.js";
import { resolvePublicUploadUrl } from "../utils/publicUploadUrl.js";
import { isLikelyPdfUpload } from "../utils/todoAttachmentUtils.js";

const router = Router();

router.use((req, res, next) => {
  console.log("[upload/router]", {
    method: req.method,
    originalUrl: req.originalUrl,
    contentType: req.headers["content-type"] || null,
  });
  next();
});

/** multipart 里 type 可能带空格、或重复字段成数组，统一后再做白名单判断 */
function normalizeUploadType(req) {
  if (!req.body) return undefined;
  let v = req.body.type;
  if (Array.isArray(v)) v = v[v.length - 1];
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s === "") {
    delete req.body.type;
    return undefined;
  }
  req.body.type = s;
  return s;
}

function resolveUploadType(req, file) {
  const normalizedType = normalizeUploadType(req);
  if (normalizedType) return normalizedType;
  // 兜底：若客户端漏传 type 但文件明显是 PDF，按 todo-file 处理，避免待办上传被误拒。
  if (isLikelyPdfUpload(file)) {
    req.body = req.body || {};
    req.body.type = "todo-file";
    return "todo-file";
  }
  return undefined;
}

function normalizeTodoId(req) {
  const raw = req.body?.todo_id ?? req.body?.todoId;
  if (raw === undefined || raw === null) return null;
  const todoId = String(raw).trim();
  return todoId || null;
}

function mapUploadTypeToAttachmentType(type) {
  if (type === "todo-image") return "image";
  if (type === "todo-video") return "video";
  if (type === "todo-file") return "file";
  return null;
}

async function bindTodoAttachmentRecord({
  userId,
  todoId,
  uploadType,
  publicUrl,
  originalName,
}) {
  const attachmentType = mapUploadTypeToAttachmentType(uploadType);
  if (!attachmentType) return;
  if (!todoId) {
    throw Object.assign(new Error("todo 上传必须提供 todo_id"), { status: 400 });
  }

  const connection = await pool.getConnection();
  const now = new Date();
  try {
    await connection.beginTransaction();

    const [todoRows] = await connection.query(
      `
        SELECT id
        FROM todos
        WHERE user_id = ? AND id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [userId, todoId]
    );
    if (!todoRows.length) {
      throw Object.assign(new Error("todo 不存在或无权限"), { status: 404 });
    }

    if (attachmentType === "file") {
      const [fileRows] = await connection.query(
        `
          SELECT id
          FROM todo_attachments
          WHERE user_id = ?
            AND todo_id = ?
            AND type = 'file'
            AND deleted_at IS NULL
          ORDER BY updated_at ASC, id ASC
          FOR UPDATE
        `,
        [userId, todoId]
      );

      if (fileRows.length > 0) {
        const keepId = String(fileRows[0].id);
        await connection.query(
          `
            UPDATE todo_attachments
            SET url = ?,
                file_name = ?,
                updated_at = ?,
                deleted_at = NULL,
                rev = rev + 1
            WHERE user_id = ? AND id = ?
          `,
          [publicUrl, originalName || null, now, userId, keepId]
        );

        for (let i = 1; i < fileRows.length; i++) {
          await connection.query(
            `
              UPDATE todo_attachments
              SET deleted_at = ?,
                  updated_at = ?,
                  rev = rev + 1
              WHERE user_id = ? AND id = ?
            `,
            [now, now, userId, String(fileRows[i].id)]
          );
        }
      } else {
        await connection.query(
          `
            INSERT INTO todo_attachments
              (user_id, id, todo_id, type, url, file_name, created_at, updated_at, deleted_at, client_id, rev)
            VALUES
              (?, ?, ?, 'file', ?, ?, ?, ?, NULL, NULL, 1)
          `,
          [userId, `att_${randomUUID()}`, todoId, publicUrl, originalName || null, now, now]
        );
      }
    } else {
      await connection.query(
        `
          INSERT INTO todo_attachments
            (user_id, id, todo_id, type, url, file_name, created_at, updated_at, deleted_at, client_id, rev)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 1)
        `,
        [userId, `att_${randomUUID()}`, todoId, attachmentType, publicUrl, originalName || null, now, now]
      );
    }

    // 触发 todo 主记录版本变化，确保 /api/todos 增量拉取能感知附件更新。
    await connection.query(
      `
        UPDATE todos
        SET updated_at = ?,
            rev = rev + 1
        WHERE user_id = ? AND id = ?
      `,
      [now, userId, todoId]
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

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
    const type = resolveUploadType(req, file);
    
    let uploadPath = path.join(uploadsDir, String(userId));
    
    if (type === "vision-image" || type === "vision-cover") {
      const boardId = req.body.board_id;
      if (!boardId) {
        return cb(new Error("愿景板图片需要提供 board_id"));
      }
      uploadPath = path.join(uploadPath, String(boardId));
    }

    if (type === "todo-image" || type === "todo-video" || type === "todo-file") {
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
    const type = resolveUploadType(req, file);
    let filename;
    
    if (type === "avatar") {
      const ext = path.extname(file.originalname);
      filename = `avatar${ext}`;
    } else if (type === "vision-cover") {
      filename = "cover.jpg";
    } else {
      // vision-image / todo-image / todo-video / todo-file
      const ext = path.extname(file.originalname) || ".bin";
      filename = `${Date.now()}${ext}`;
    }
    
    cb(null, filename);
  }
});

// 文件过滤器：todo-file 仅 PDF；其它 type 仅图片/视频。
// multipart 中若 file 早于 type 字段，req.body.type 可能暂为空，此时放行 PDF，由 handler 按 type 再校验。
const fileFilter = (req, file, cb) => {
  console.log(
    "[upload/fileFilter] bodyType=%s, mime=%s, name=%s, isLikelyPdf=%s",
    req.body?.type,
    file.mimetype,
    file.originalname,
    isLikelyPdfUpload(file)
  );
  const type = resolveUploadType(req, file);
  const fileMime = String(file.mimetype || "").trim().toLowerCase();
  const allowedImageMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const allowedVideoMimes = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v"
  ];
  const imageVideoOnlyMsg =
    "仅支持图片/视频文件 (JPEG、PNG、WebP、GIF、MP4、WebM、MOV、M4V)";

  if (type === "todo-file") {
    if (isLikelyPdfUpload(file)) return cb(null, true);
    return cb(new Error("仅支持 PDF 文件"));
  }

  if (allowedImageMimes.includes(fileMime)) return cb(null, true);
  if (allowedVideoMimes.includes(fileMime)) return cb(null, true);

  if (isLikelyPdfUpload(file)) {
    if (type === undefined || type === "") return cb(null, true);
    return cb(new Error("PDF 文件仅支持 todo-file 场景"));
  }

  return cb(new Error(imageVideoOnlyMsg));
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
  upload.fields([{ name: "file", maxCount: 1 }]),
  async (req, res) => {
    try {
      const fileList = req.files?.file;
      const file = fileList?.[0];
      if (!file) {
        return res.status(400).json({
          success: false,
          error: "未上传文件"
        });
      }
      req.file = file;

      console.log(
        "[upload/handler] bodyType=%s, fileMime=%s, fileSize=%s",
        req.body?.type,
        req.file?.mimetype,
        req.file?.size
      );

      const type = resolveUploadType(req, req.file);
      if (
        !type ||
        !["avatar", "vision-image", "vision-cover", "todo-image", "todo-video", "todo-file"].includes(type)
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
      if (type === "todo-file" && !isLikelyPdfUpload(req.file)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          error: "文件上传失败",
          message: "仅支持 PDF 文件"
        });
      }
      if (type === "todo-file" && Number(req.file.size || 0) > 10 * 1024 * 1024) {
        fs.unlinkSync(req.file.path);
        return res.status(413).json({
          success: false,
          error: "文件大小超过限制",
          message: "PDF 文件大小不能超过 10MB"
        });
      }
      if (
        type !== "todo-video" &&
        type !== "todo-file" &&
        !String(req.file.mimetype || "").startsWith("image/")
      ) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: "该类型必须上传图片文件" });
      }

      // 构建公开可访问的 URL
      // 相对路径：uploads/userId/... 或 uploads/userId/boardId/...
      const relativePath = req.file.path.replace(uploadsDir + path.sep, "").replace(/\\/g, "/");
      const publicUrl = resolvePublicUploadUrl(relativePath, req);

      if (["todo-image", "todo-video", "todo-file"].includes(type)) {
        const todoId = normalizeTodoId(req);
        if (!todoId) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({
            success: false,
            error: "todo 上传必须提供 todo_id"
          });
        }
        await bindTodoAttachmentRecord({
          userId: req.userId,
          todoId,
          uploadType: type,
          publicUrl,
          originalName: req.file.originalname
        });
      }

      res.json({
        url: publicUrl,
        file_name: req.file.originalname || null,
        mime_type: req.file.mimetype || null,
        size: Number(req.file.size || 0)
      });
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
      
      const status = Number(error?.status) || 500;
      res.status(status).json({
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
      if (normalizeUploadType(req) === "todo-file") {
        return res.status(413).json({
          success: false,
          error: "文件大小超过限制",
          message: "PDF 文件大小不能超过 10MB"
        });
      }
      return res.status(400).json({
        success: false,
        error: "文件大小超过限制",
        message: "文件大小不能超过 50MB"
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        error: "最多仅支持上传 1 个文件"
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



