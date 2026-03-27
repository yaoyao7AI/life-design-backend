/**
 * 上传文件在磁盘上的相对路径（相对项目 uploads 根）→ 浏览器可打开的完整 URL。
 * 生产环境应设置 PUBLIC_ASSET_BASE_URL（如 https://api.life-design.me），避免 Mixed Content。
 *
 * @param {string} relativePath 例如 "7/12/cover.jpg"
 * @param {{ protocol: string, get: (name: string) => string | undefined }} req Express request
 * @returns {string}
 */
export function resolvePublicUploadUrl(relativePath, req) {
  const base =
    (process.env.PUBLIC_ASSET_BASE_URL || "").replace(/\/$/, "") || null;
  if (base) {
    return `${base}/uploads/${relativePath}`;
  }
  const host = req.get("host") || "";
  return `${req.protocol}://${host}/uploads/${relativePath}`;
}

/**
 * 规范化已存在的 uploads 地址，确保生产写库统一到 PUBLIC_ASSET_BASE_URL。
 * - 支持 "/uploads/.."
 * - 支持 "uploads/.."
 * - 支持 "http(s)://任意域名/uploads/.."
 * 未匹配或未配置 PUBLIC_ASSET_BASE_URL 时保持原值不变。
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export function normalizeUploadsUrl(value) {
  if (typeof value !== "string" || !value) return value;

  const base =
    (process.env.PUBLIC_ASSET_BASE_URL || "").replace(/\/$/, "") || null;
  if (!base) return value;

  const relativeFromAbsolute = value.match(/^https?:\/\/[^/]+\/uploads\/(.+)$/i);
  if (relativeFromAbsolute) {
    return `${base}/uploads/${relativeFromAbsolute[1]}`;
  }

  if (value.startsWith("/uploads/")) {
    return `${base}${value}`;
  }

  if (value.startsWith("uploads/")) {
    return `${base}/${value}`;
  }

  return value;
}
