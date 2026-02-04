-- 添加 password 字段到 users 表
-- 执行时间：2025-01-XX
-- 说明：为支持修改密码功能

USE life_design;

-- 检查字段是否存在，如果不存在则添加
-- 注意：如果字段已存在，这个语句会报错，可以忽略

ALTER TABLE users 
ADD COLUMN password VARCHAR(255) NULL AFTER phone;

-- 说明：
-- 1. password 字段允许为 NULL（因为现有用户没有密码）
-- 2. 字段位置在 phone 字段之后
-- 3. 长度 255 足够存储加密后的密码（bcrypt 加密后约 60 字符）

-- 验证字段是否添加成功
-- DESCRIBE users;



