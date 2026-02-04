-- 添加 short_url 字段到 affirmations 表
-- 在阿里云 RDS 执行此 SQL

USE life_design;

-- 添加 short_url 字段（如果不存在）
ALTER TABLE affirmations 
ADD COLUMN IF NOT EXISTS short_url VARCHAR(500) AFTER audio_url;

-- 查看表结构
DESCRIBE affirmations;



