
-- 1. 移除旧的、可能过时的检查约束
ALTER TABLE user_missions DROP CONSTRAINT IF EXISTS user_missions_status_check;

-- 2. 添加新的、兼容性更强的检查约束
-- 包含了代码中可能出现的所有状态：
-- 'todo': 待办
-- 'in-progress': 进行中 (Typescript 定义)
-- 'active': 激活 (旧 SQL 定义)
-- 'ongoing': 进行中 (部分前端代码)
-- 'completed': 完成
-- 'claimed': 已领取
-- 'locked': 未解锁
ALTER TABLE user_missions 
ADD CONSTRAINT user_missions_status_check 
CHECK (status IN ('todo', 'in-progress', 'active', 'ongoing', 'completed', 'claimed', 'locked'));

-- 3. 清空数据
TRUNCATE TABLE public.missions CASCADE;

-- 4. 插入标准的 9 个任务
INSERT INTO public.missions (id, title, description, type, target, reward_coins, reward_experience, frequency)
VALUES
  ('daily_run_1', '每日开跑', '完成一次任意距离的跑步', 'RUN_COUNT', 1, 10, 50, 'daily'),
  ('daily_dist_3', '每日3公里', '单日累计跑步距离达到3公里', 'DISTANCE', 3000, 30, 100, 'daily'),
  ('daily_hex_10', '领地扩张', '单日占领或访问10个地块', 'HEX_COUNT', 10, 20, 80, 'daily'),
  ('weekly_dist_15', '周跑者', '本周累计跑步15公里', 'DISTANCE', 15000, 100, 500, 'weekly'),
  ('weekly_night_3', '夜行侠', '本周完成3次夜跑（22:00-04:00）', 'NIGHT_RUN', 3, 80, 400, 'weekly'),
  ('weekly_active_3', '活跃跑者', '本周累计跑步3天', 'ACTIVE_DAYS', 3, 50, 300, 'weekly'),
  ('ach_first_run', '初次启程', '完成你的第一次跑步', 'RUN_COUNT', 1, 50, 200, 'achievement'),
  ('ach_marathon', '累计马拉松', '累计跑步距离达到42.195公里', 'DISTANCE', 42195, 500, 2000, 'achievement'),
  ('ach_landlord', '大地主', '累计拥有100个地块', 'HEX_TOTAL', 100, 1000, 5000, 'achievement');

-- 5. 强制为所有用户分配这些任务 (使用 'in-progress')
INSERT INTO public.user_missions (user_id, mission_id, status, progress, updated_at)
SELECT u.id, m.id, 'in-progress', 0, NOW()
FROM auth.users u
CROSS JOIN public.missions m;
