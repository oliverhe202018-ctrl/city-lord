
-- 1. 清理脏数据 (关键步骤)
-- 删除 user_missions 中所有在 missions 表里找不到对应 ID 的记录
-- 这一步是必须的，否则无法创建外键约束
DELETE FROM user_missions
WHERE mission_id NOT IN (SELECT id FROM missions);

-- 2. 确保字段类型正确 (防止之前的操作只成功了一半)
-- 先移除旧的主键约束(如果有)
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_pkey CASCADE;

-- 确保 ID 都是 text 类型
ALTER TABLE missions ALTER COLUMN id TYPE text;
ALTER TABLE user_missions ALTER COLUMN mission_id TYPE text;

-- 重新添加 missions 表的主键
ALTER TABLE missions ADD PRIMARY KEY (id);

-- 3. 安全地添加外键约束
-- 先删除可能存在的旧约束，避免命名冲突
ALTER TABLE user_missions DROP CONSTRAINT IF EXISTS user_missions_mission_id_fkey;

-- 添加外键
ALTER TABLE user_missions
ADD CONSTRAINT user_missions_mission_id_fkey
FOREIGN KEY (mission_id)
REFERENCES missions(id)
ON DELETE CASCADE;
