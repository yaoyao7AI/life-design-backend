import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// JWT 认证中间件
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    // 兼容不同的 token 格式（id 或 userId）
    req.userId = decoded.id || decoded.userId;
    req.user = decoded;
    next();
  });
};
