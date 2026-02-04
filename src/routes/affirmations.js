import { Router } from "express";
import { pool } from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// 获取前端基础 URL（用于生成短链接）
const getFrontendBaseUrl = () => {
  return process.env.FRONTEND_BASE_URL || "http://localhost:5174";
};

// 生成格式化的 code（如 001, 002, 003）
const generateCode = async () => {
  try {
    // 获取当前最大的数字 code
    const [rows] = await pool.query(
      "SELECT code FROM affirmations WHERE code REGEXP '^[0-9]+$' ORDER BY CAST(code AS UNSIGNED) DESC LIMIT 1"
    );
    
    let nextNumber = 1;
    if (rows.length > 0 && rows[0].code) {
      nextNumber = parseInt(rows[0].code, 10) + 1;
    }
    
    // 格式化为3位数字，如 001, 002
    return String(nextNumber).padStart(3, '0');
  } catch (err) {
    console.error("生成 code 错误:", err);
    // 如果出错，使用时间戳作为后备
    return String(Date.now()).slice(-3);
  }
};

// 生成短链接
const generateShortUrl = (code) => {
  const baseUrl = getFrontendBaseUrl();
  return `${baseUrl}/play?a=${code}`;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保音频上传目录存在
const audioUploadsDir = path.join(__dirname, "../../uploads/audio");
if (!fs.existsSync(audioUploadsDir)) {
  fs.mkdirSync(audioUploadsDir, { recursive: true });
}

// 配置音频文件上传
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, audioUploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".mp3";
    const filename = `audio-${Date.now()}${ext}`;
    cb(null, filename);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", 
      "audio/wave", "audio/ogg", "audio/webm", "audio/aac",
      "video/mp4"  // 支持 MP4 视频/音频文件
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|m4a|aac|mp4)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("仅支持音频文件 (mp3, wav, ogg, m4a, aac, mp4)"));
    }
  }
});

// GET /api/affirmations - 获取所有肯定语列表
router.get("/", async (req, res) => {
  try {
    // 检查表是否有 title 和 audio_url 字段
    const [columns] = await pool.query(
      "SHOW COLUMNS FROM affirmations LIKE 'title'"
    );
    const hasTitle = columns.length > 0;
    
    const [audioColumns] = await pool.query(
      "SHOW COLUMNS FROM affirmations LIKE 'audio_url'"
    );
    const hasAudioUrl = audioColumns.length > 0;
    
    // 检查是否有 short_url 字段
    const [shortUrlCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'short_url'");
    const hasShortUrl = shortUrlCols.length > 0;
    
    const selectFields = hasTitle && hasAudioUrl && hasShortUrl
      ? `id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, COALESCE(short_url, '') as short_url, category`
      : hasTitle && hasAudioUrl
      ? `id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, '' as short_url, category`
      : `id, SUBSTRING(text, 1, 50) as title, text, '' as audio_url, code, '' as short_url, category`;
    
    const [rows] = await pool.query(
      `SELECT ${selectFields} FROM affirmations ORDER BY id ASC`
    );
    
    // 转换为前端需要的格式，如果没有 short_url 字段则生成
    const formattedRows = rows.map(row => {
      let shortUrl = row.short_url || "";
      // 如果数据库没有 short_url 字段或为空，且 code 存在，则生成
      if (!shortUrl && row.code) {
        shortUrl = generateShortUrl(row.code);
      }
      
      return {
        id: row.id,
        title: row.title || row.text.substring(0, 50),
        text: row.text,
        audio_url: row.audio_url || "",
        code: row.code || "",
        short_url: shortUrl
      };
    });
    
    res.json(formattedRows);
  } catch (err) {
    console.error("Error fetching affirmations:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/affirmations/:id - 获取单个肯定语（支持 id 或 code）
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查表是否有 title、audio_url 和 short_url 字段
    const [titleCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'title'");
    const [audioCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'audio_url'");
    const [shortUrlCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'short_url'");
    const hasTitle = titleCols.length > 0;
    const hasAudioUrl = audioCols.length > 0;
    const hasShortUrl = shortUrlCols.length > 0;
    
    const selectFields = hasTitle && hasAudioUrl && hasShortUrl
      ? "id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, COALESCE(short_url, '') as short_url, category"
      : hasTitle && hasAudioUrl
      ? "id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, '' as short_url, category"
      : "id, SUBSTRING(text, 1, 50) as title, text, '' as audio_url, code, '' as short_url, category";
    
    // 判断是数字 id 还是 code
    const isNumeric = /^\d+$/.test(id);
    const query = isNumeric 
      ? `SELECT ${selectFields} FROM affirmations WHERE id = ?`
      : `SELECT ${selectFields} FROM affirmations WHERE code = ?`;
    
    const [rows] = await pool.query(query, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: "肯定语不存在" });
    }
    
    const row = rows[0];
    let shortUrl = row.short_url || "";
    // 如果数据库没有 short_url 字段或为空，且 code 存在，则生成
    if (!shortUrl && row.code) {
      shortUrl = generateShortUrl(row.code);
    }
    
    res.json({
      id: row.id,
      title: row.title || row.text.substring(0, 50),
      text: row.text,
      audio_url: row.audio_url || "",
      code: row.code || "",
      short_url: shortUrl
    });
  } catch (err) {
    console.error("Error fetching affirmation:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/affirmations - 创建肯定语
router.post("/", async (req, res) => {
  try {
    const { title, text, audio_url, code, category } = req.body;

    // 验证必填字段
    if (!text) {
      return res.status(400).json({ error: "text 不能为空" });
    }

    // 检查表是否有 title 和 audio_url 字段
    const [titleCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'title'");
    const [audioCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'audio_url'");
    const hasTitle = titleCols.length > 0;
    const hasAudioUrl = audioCols.length > 0;
    
    // 如果没有 title，使用 text 的前50个字符
    const finalTitle = title || text.substring(0, 50);

    // 如果没有提供 code，自动生成格式化的 code（如 001, 002）
    const finalCode = code || await generateCode();
    const shortUrl = generateShortUrl(finalCode);
    
    // 检查是否有 short_url 字段
    const [shortUrlCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'short_url'");
    const hasShortUrl = shortUrlCols.length > 0;
    
    let insertQuery, insertValues;
    if (hasTitle && hasAudioUrl && hasShortUrl) {
      insertQuery = "INSERT INTO affirmations (title, text, audio_url, code, short_url, category) VALUES (?, ?, ?, ?, ?, ?)";
      insertValues = [finalTitle, text, audio_url || null, finalCode, shortUrl, category || null];
    } else if (hasTitle && hasAudioUrl) {
      insertQuery = "INSERT INTO affirmations (title, text, audio_url, code, category) VALUES (?, ?, ?, ?, ?)";
      insertValues = [finalTitle, text, audio_url || null, finalCode, category || null];
    } else if (hasTitle && hasShortUrl) {
      insertQuery = "INSERT INTO affirmations (title, text, code, short_url, category) VALUES (?, ?, ?, ?, ?)";
      insertValues = [finalTitle, text, finalCode, shortUrl, category || null];
    } else if (hasTitle) {
      insertQuery = "INSERT INTO affirmations (title, text, code, category) VALUES (?, ?, ?, ?)";
      insertValues = [finalTitle, text, finalCode, category || null];
    } else if (hasAudioUrl && hasShortUrl) {
      insertQuery = "INSERT INTO affirmations (text, audio_url, code, short_url, category) VALUES (?, ?, ?, ?, ?)";
      insertValues = [text, audio_url || null, finalCode, shortUrl, category || null];
    } else if (hasAudioUrl) {
      insertQuery = "INSERT INTO affirmations (text, audio_url, code, category) VALUES (?, ?, ?, ?)";
      insertValues = [text, audio_url || null, finalCode, category || null];
    } else if (hasShortUrl) {
      insertQuery = "INSERT INTO affirmations (text, code, short_url, category) VALUES (?, ?, ?, ?)";
      insertValues = [text, finalCode, shortUrl, category || null];
    } else {
      insertQuery = "INSERT INTO affirmations (text, code, category) VALUES (?, ?, ?)";
      insertValues = [text, finalCode, category || null];
    }

    const [result] = await pool.query(insertQuery, insertValues);

    const selectFields = hasTitle && hasAudioUrl && hasShortUrl
      ? "id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, COALESCE(short_url, '') as short_url"
      : hasTitle && hasAudioUrl
      ? "id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, '' as short_url"
      : hasTitle
      ? "id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, '' as audio_url, code, '' as short_url"
      : hasAudioUrl
      ? "id, SUBSTRING(text, 1, 50) as title, text, COALESCE(audio_url, '') as audio_url, code, '' as short_url"
      : "id, SUBSTRING(text, 1, 50) as title, text, '' as audio_url, code, '' as short_url";
    
    const [newRow] = await pool.query(
      `SELECT ${selectFields} FROM affirmations WHERE id = ?`,
      [result.insertId]
    );

    const row = newRow[0];
    let finalShortUrl = row.short_url || "";
    if (!finalShortUrl && row.code) {
      finalShortUrl = generateShortUrl(row.code);
    }

    res.status(201).json({
      id: row.id,
      title: row.title,
      text: row.text,
      audio_url: row.audio_url || "",
      code: row.code || "",
      short_url: finalShortUrl
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "该 code 已存在" });
    }
    console.error("Error creating affirmation:", err);
    res.status(500).json({ error: "创建失败", message: err.message });
  }
});

// PUT /api/affirmations/:id - 更新肯定语（支持 id 或 code）
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, text, audio_url } = req.body;

    // 判断是数字 id 还是 code
    const isNumeric = /^\d+$/.test(id);
    const whereClause = isNumeric ? "WHERE id = ?" : "WHERE code = ?";

    // 检查是否存在
    const [existing] = await pool.query(
      `SELECT id FROM affirmations ${whereClause}`,
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: "肯定语不存在" });
    }

    // 检查表是否有 title、audio_url 和 short_url 字段
    const [titleCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'title'");
    const [audioCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'audio_url'");
    const [shortUrlCols] = await pool.query("SHOW COLUMNS FROM affirmations LIKE 'short_url'");
    const hasTitle = titleCols.length > 0;
    const hasAudioUrl = audioCols.length > 0;
    const hasShortUrl = shortUrlCols.length > 0;
    
    // 构建更新字段
    const updateFields = [];
    const updateValues = [];

    if (title !== undefined && hasTitle) {
      updateFields.push("title = ?");
      updateValues.push(title);
    }
    if (text !== undefined) {
      updateFields.push("text = ?");
      updateValues.push(text);
    }
    if (audio_url !== undefined && hasAudioUrl) {
      updateFields.push("audio_url = ?");
      updateValues.push(audio_url);
    }
    // 如果更新了 code，需要重新生成 short_url
    if (req.body.code !== undefined) {
      const newCode = req.body.code;
      const newShortUrl = generateShortUrl(newCode);
      if (hasShortUrl) {
        updateFields.push("code = ?");
        updateFields.push("short_url = ?");
        updateValues.push(newCode, newShortUrl);
      } else {
        updateFields.push("code = ?");
        updateValues.push(newCode);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: "没有要更新的字段" });
    }

    updateValues.push(id);
    await pool.query(
      `UPDATE affirmations SET ${updateFields.join(", ")} ${whereClause}`,
      updateValues
    );

    // 返回更新后的数据
    const selectFields = hasTitle && hasAudioUrl && hasShortUrl
      ? "id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, COALESCE(short_url, '') as short_url"
      : hasTitle && hasAudioUrl
      ? "id, COALESCE(title, SUBSTRING(text, 1, 50)) as title, text, COALESCE(audio_url, '') as audio_url, code, '' as short_url"
      : "id, SUBSTRING(text, 1, 50) as title, text, '' as audio_url, code, '' as short_url";
    
    const [updated] = await pool.query(
      `SELECT ${selectFields} FROM affirmations ${whereClause}`,
      [id]
    );
    
    const row = updated[0];
    let finalShortUrl = row.short_url || "";
    if (!finalShortUrl && row.code) {
      finalShortUrl = generateShortUrl(row.code);
    }

    res.json({
      id: row.id,
      title: row.title || row.text.substring(0, 50),
      text: row.text,
      audio_url: row.audio_url || "",
      code: row.code || "",
      short_url: finalShortUrl
    });
  } catch (err) {
    console.error("Error updating affirmation:", err);
    res.status(500).json({ error: "更新失败" });
  }
});

// DELETE /api/affirmations/:id - 删除肯定语（支持 id 或 code）
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // 判断是数字 id 还是 code
    const isNumeric = /^\d+$/.test(id);
    const whereClause = isNumeric ? "WHERE id = ?" : "WHERE code = ?";
    
    const [result] = await pool.query(
      `DELETE FROM affirmations ${whereClause}`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "肯定语不存在" });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting affirmation:", err);
    res.status(500).json({ error: "删除失败" });
  }
});

// POST /api/affirmations/upload-audio - 上传音频文件
router.post("/upload-audio", audioUpload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "未上传文件" });
    }

    // 构建公开可访问的 URL
    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/audio/${req.file.filename}`;

    res.json({
      url: publicUrl
    });
  } catch (error) {
    console.error("[音频上传错误]", error);
    
    // 如果文件已上传但处理失败，删除文件
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (unlinkError) {
        console.error("[删除文件失败]", unlinkError);
      }
    }
    
    res.status(500).json({
      error: "音频上传失败",
      message: error.message
    });
  }
});

export default router;

