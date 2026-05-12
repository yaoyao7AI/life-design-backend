USE life_design;

-- 允许 Todo 附件类型新增 file（用于 PDF 文件预览）。
ALTER TABLE todo_attachments
  MODIFY COLUMN type ENUM('image','video','file') NOT NULL;
