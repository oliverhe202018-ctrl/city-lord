
-- 1. 确保 RLS 启用
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- 2. 修复/添加 missions 表的策略
-- 删除旧策略以防冲突
DROP POLICY IF EXISTS "Allow public read missions" ON public.missions;
DROP POLICY IF EXISTS "Allow authenticated read missions" ON public.missions;
DROP POLICY IF EXISTS "Allow authenticated insert missions" ON public.missions;

-- 允许所有认证用户读取任务模板
CREATE POLICY "Allow authenticated read missions" ON public.missions
FOR SELECT TO authenticated USING (true);

-- 允许认证用户插入任务模板 (用于自动初始化)
CREATE POLICY "Allow authenticated insert missions" ON public.missions
FOR INSERT TO authenticated WITH CHECK (true);

-- 允许认证用户更新任务模板 (用于自动修复)
CREATE POLICY "Allow authenticated update missions" ON public.missions
FOR UPDATE TO authenticated USING (true);

-- 3. 修复/添加 user_missions 表的策略
DROP POLICY IF EXISTS "Users can read own missions" ON public.user_missions;
DROP POLICY IF EXISTS "Users can insert own missions" ON public.user_missions;
DROP POLICY IF EXISTS "Users can update own missions" ON public.user_missions;

CREATE POLICY "Users can read own missions" ON public.user_missions
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own missions" ON public.user_missions
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own missions" ON public.user_missions
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 4. 插入/更新默认任务数据 (确保数据存在)
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
  ('ach_landlord', '大地主', '累计拥有100个地块', 'HEX_TOTAL', 100, 1000, 5000, 'achievement')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  target = EXCLUDED.target,
  reward_coins = EXCLUDED.reward_coins,
  reward_experience = EXCLUDED.reward_experience,
  frequency = EXCLUDED.frequency;
