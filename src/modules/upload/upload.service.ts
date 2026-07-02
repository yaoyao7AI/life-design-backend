import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { imageSize } from "image-size";
import { pool } from "../../db/index.js";

type UploadRow = {
  id: string;
  file_name: string;
  original_name: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  storage_path: string;
  url: string;
  created_by: string | null;
  created_at: Date;
};

export class UploadServiceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

function monthFolder() {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}/${month}`;
}

export function ensureUploadDir() {
  const dir = path.join(process.cwd(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function buildUploadStorage(file: Express.Multer.File) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();

  if (!ALLOWED_MIME.has(mime) || !ALLOWED_EXT.has(ext)) {
    throw new UploadServiceError(
      "UNSUPPORTED_FILE_TYPE",
      "仅支持 jpg/jpeg/png/webp/gif",
      400
    );
  }

  const folder = monthFolder();
  const uploadBaseDir = ensureUploadDir();
  const targetDir = path.join(uploadBaseDir, folder);
  fs.mkdirSync(targetDir, { recursive: true });

  const fileId = randomUUID();
  const fileName = `${fileId}${ext}`;
  const absolutePath = path.join(targetDir, fileName);
  const storagePath = path.join("uploads", folder, fileName).replace(/\\/g, "/");
  const relativeUrl = `/${storagePath}`;

  return {
    id: fileId,
    file_name: fileName,
    absolute_path: absolutePath,
    storage_path: storagePath,
    relative_url: relativeUrl,
  };
}

function readImageSize(absolutePath: string) {
  try {
    const size = imageSize(absolutePath);
    return {
      width: Number(size.width || 0),
      height: Number(size.height || 0),
    };
  } catch {
    return { width: 0, height: 0 };
  }
}

function mapUploadRow(row: any): UploadRow {
  return {
    id: String(row.id),
    file_name: String(row.file_name),
    original_name: String(row.original_name),
    mime: String(row.mime),
    size: Number(row.size || 0),
    width: Number(row.width || 0),
    height: Number(row.height || 0),
    storage_path: String(row.storage_path),
    url: String(row.url),
    created_by: row.created_by == null ? null : String(row.created_by),
    created_at: new Date(row.created_at),
  };
}

function serializeUpload(upload: UploadRow) {
  return {
    id: upload.id,
    url: upload.url,
    width: upload.width,
    height: upload.height,
    size: upload.size,
    mime: upload.mime,
    file_name: upload.file_name,
    original_name: upload.original_name,
    storage_path: upload.storage_path,
    created_by: upload.created_by,
    created_at: upload.created_at.toISOString(),
  };
}

export const uploadService = {
  async createUploadRecord(params: {
    file: Express.Multer.File;
    fileId: string;
    fileName: string;
    storagePath: string;
    url: string;
    absolutePath: string;
    createdBy?: string | null;
  }) {
    const dimensions = readImageSize(params.absolutePath);
    await pool.query(
      `
      INSERT INTO uploads (
        id, file_name, original_name, mime, size, width, height,
        storage_path, url, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        params.fileId,
        params.fileName,
        params.file.originalname || params.fileName,
        params.file.mimetype,
        Number(params.file.size || 0),
        dimensions.width,
        dimensions.height,
        params.storagePath,
        params.url,
        params.createdBy || null,
      ]
    );

    const created = await this.getById(params.fileId);
    if (!created) throw new UploadServiceError("UPLOAD_SAVE_FAILED", "上传记录保存失败", 500);
    return created;
  },

  async getById(id: string) {
    const [rows] = await pool.query(
      `
      SELECT id, file_name, original_name, mime, size, width, height, storage_path, url, created_by, created_at
      FROM uploads
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );
    const row = (rows as any[])[0];
    if (!row) return null;
    return serializeUpload(mapUploadRow(row));
  },

  async deleteById(id: string) {
    const [result] = await pool.query("DELETE FROM uploads WHERE id = ?", [id]);
    const affectedRows = Number((result as any)?.affectedRows || 0);
    return { id, deleted: affectedRows > 0 };
  },
};
