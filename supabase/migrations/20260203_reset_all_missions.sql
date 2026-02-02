
-- ⚠️ 警告：这将清空所有任务数据并重置
-- 1. 清空 missions 表 (CASCADE 会自动清空 user_missions)
TRUNCATE TABLE public.missions CASCADE;

-- 2. 插入标准的 9 个任务
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

-- 3. 强制为所有用户分配这些任务
INSERT INTO public.user_missions (user_id, mission_id, status, progress, updated_at)
SELECT u.id, m.id, 'active', 0, NOW()
FROM auth.users u
CROSS JOIN public.missions m;
