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
