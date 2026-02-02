
-- 1. 修改 missions 表的主键类型为 text
-- 注意：CASCADE 会自动删除依赖于此主键的外键约束，这正是我们需要的
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_pkey CASCADE;

-- 将 id 字段类型改为 text
ALTER TABLE missions ALTER COLUMN id TYPE text;

-- 重新添加主键约束
ALTER TABLE missions ADD PRIMARY KEY (id);

-- 2. 确保 user_missions.mission_id 也是 text (根据你的报错它已经是了，但为了保险再次确认)
ALTER TABLE user_missions ALTER COLUMN mission_id TYPE text;

-- 3. 重新建立 user_missions 到 missions 的外键约束
ALTER TABLE user_missions
ADD CONSTRAINT user_missions_mission_id_fkey
FOREIGN KEY (mission_id)
REFERENCES missions(id)
ON DELETE CASCADE;
