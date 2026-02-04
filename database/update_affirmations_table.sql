-- 更新 affirmations 表结构，添加 title 和 audio_url 字段
-- 在阿里云 RDS 执行此 SQL

USE life_design;

-- 添加 title 字段（如果不存在）
ALTER TABLE affirmations 
ADD COLUMN IF NOT EXISTS title VARCHAR(200) AFTER code;

-- 添加 audio_url 字段（如果不存在）
ALTER TABLE affirmations 
ADD COLUMN IF NOT EXISTS audio_url VARCHAR(500) AFTER text;

-- 如果 title 为空，使用 text 的前50个字符作为 title
UPDATE affirmations 
SET title = SUBSTRING(text, 1, 50) 
WHERE title IS NULL OR title = '';

-- 查看表结构
DESCRIBE affirmations;



