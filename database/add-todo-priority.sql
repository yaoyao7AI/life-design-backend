USE life_design;

-- 待办优先级 P0–P5（0 最高，5 最低）；NULL 表示历史数据尚未同步
ALTER TABLE todos ADD COLUMN priority TINYINT NULL AFTER tag;
