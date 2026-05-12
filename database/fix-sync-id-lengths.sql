USE life_design;

-- 兼容长期主义生成的长 ID（如 84 字符）；
-- 扩容同步链路中的相关主键/外键/关联字段到 VARCHAR(128)。

ALTER TABLE todo_attachments DROP FOREIGN KEY fk_todo_attachments_todos;

ALTER TABLE todos
  MODIFY COLUMN id VARCHAR(128) NOT NULL;

ALTER TABLE todo_attachments
  MODIFY COLUMN id VARCHAR(128) NOT NULL,
  MODIFY COLUMN todo_id VARCHAR(128) NOT NULL;

ALTER TABLE todo_attachments
  ADD CONSTRAINT fk_todo_attachments_todos
    FOREIGN KEY (user_id, todo_id) REFERENCES todos(user_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE long_term_activities DROP FOREIGN KEY fk_long_term_activities_plans;

ALTER TABLE long_term_plans
  MODIFY COLUMN id VARCHAR(128) NOT NULL;

ALTER TABLE long_term_activities
  MODIFY COLUMN id VARCHAR(128) NOT NULL,
  MODIFY COLUMN plan_id VARCHAR(128) NOT NULL;

ALTER TABLE long_term_activities
  ADD CONSTRAINT fk_long_term_activities_plans
    FOREIGN KEY (user_id, plan_id) REFERENCES long_term_plans(user_id, id)
      ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE vision_board_todos
  MODIFY COLUMN linked_todo_id VARCHAR(128) NULL;
