USE life_design;

-- 待办专注记录列表（JSON 数组）；NULL = 尚未同步
ALTER TABLE todos ADD COLUMN focus_records JSON NULL AFTER priority;
