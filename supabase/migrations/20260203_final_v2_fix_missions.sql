
-- 1. 清理脏数据 (绝对稳健版)
-- 我们显式地将两边都转换为 text 类型进行比较，确保不会报类型错误
DELETE FROM user_missions
WHERE mission_id::text NOT IN (SELECT id::text FROM missions);

-- 2. 修改 missions 表结构
-- 移除旧的主键约束
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_pkey CASCADE;

-- 将 id 字段类型强制改为 text
ALTER TABLE missions ALTER COLUMN id TYPE text;

-- 重新添加主键
ALTER TABLE missions ADD PRIMARY KEY (id);

-- 3. 确保 user_missions 结构正确
ALTER TABLE user_missions ALTER COLUMN mission_id TYPE text;

-- 4. 重建外键
-- 先删除旧约束
ALTER TABLE user_missions DROP CONSTRAINT IF EXISTS user_missions_mission_id_fkey;

-- 添加新外键
ALTER TABLE user_missions
ADD CONSTRAINT user_missions_mission_id_fkey
FOREIGN KEY (mission_id)
REFERENCES missions(id)
ON DELETE CASCADE;
