USE life_design;

ALTER TABLE todos ADD COLUMN vision_board_id VARCHAR(64) NULL AFTER vision_id;
ALTER TABLE todos ADD COLUMN energy_feedback VARCHAR(20) NULL AFTER ai_tags;
ALTER TABLE todos ADD COLUMN meaning_feedback VARCHAR(20) NULL AFTER energy_feedback;
