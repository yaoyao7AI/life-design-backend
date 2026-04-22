import { normalizeUploadsUrl } from "./publicUploadUrl.js";

export function normalizeTodoAttachmentType(value) {
  const type = String(value ?? "")
    .trim()
    .toLowerCase();
  if (type === "pdf") return "file";
  if (type === "image" || type === "video" || type === "file") return type;
  return null;
}

export function isPdfMimeType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase() === "application/pdf";
}

/** 上传场景：部分客户端/代理会把 PDF 标成 application/octet-stream 或空 MIME；文件名也可能含空格/非常规 MIME */
export function isLikelyPdfUpload(file) {
  if (!file) return false;
  const mime = String(file.mimetype || "").trim().toLowerCase();
  if (mime === "application/pdf" || mime === "application/x-pdf") return true;
  if (mime.includes("pdf") && mime.startsWith("application/")) return true;

  const base = String(file.originalname || "").trim();
  const nameLooksPdf = /\.pdf$/i.test(base);
  if (!nameLooksPdf) return false;

  // 代理链路可能改写 MIME；只要文件名明确是 .pdf，且 MIME 不是明显图片/视频，也按 PDF 处理。
  if (mime.startsWith("image/") || mime.startsWith("video/")) return false;
  if (mime && mime !== "application/octet-stream" && mime !== "binary/octet-stream" && mime !== "application/unknown") {
    return true;
  }

  if (
    mime === "" ||
    mime === "application/octet-stream" ||
    mime === "binary/octet-stream" ||
    mime === "application/unknown"
  ) {
    return true;
  }
  return false;
}

export function normalizeTodoAttachmentsInput(value) {
  if (value === undefined) return { provided: false, items: [] };
  if (value === null) return { provided: true, items: [] };
  if (!Array.isArray(value)) {
    throw Object.assign(new Error("attachments 必须是数组"), { status: 400 });
  }

  const items = value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw Object.assign(new Error(`attachments[${index}] 必须是对象`), { status: 400 });
    }

    const type = normalizeTodoAttachmentType(item.type ?? item.kind);
    if (!type) {
      throw Object.assign(new Error(`attachments[${index}].type 非法`), { status: 400 });
    }

    const rawUrl = item.url ?? item.file_url ?? item.fileUrl ?? item.publicUrl;
    const url =
      typeof rawUrl === "string" ? String(normalizeUploadsUrl(rawUrl)).trim() : "";
    if (!url) {
      throw Object.assign(new Error(`attachments[${index}].url 不能为空`), { status: 400 });
    }

    const rawFileName = item.file_name ?? item.fileName ?? item.name ?? null;
    const fileName =
      rawFileName === undefined || rawFileName === null || String(rawFileName).trim() === ""
        ? null
        : String(rawFileName).trim().slice(0, 255);

    if (type === "file" && !/\.pdf(?:$|[?#])/i.test(url) && !/\.pdf$/i.test(fileName || "")) {
      throw Object.assign(new Error("文件附件仅支持 PDF"), { status: 400 });
    }

    const id =
      typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 128) : null;

    return {
      id,
      type,
      url,
      file_name: fileName,
    };
  });

  const fileCount = items.filter((item) => item.type === "file").length;
  if (fileCount > 1) {
    throw Object.assign(new Error("最多只能上传 1 个文件附件"), { status: 400 });
  }

  return { provided: true, items };
}
