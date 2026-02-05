-- 1. 补全 rooms 表缺失列 (修复 allow_imports 报错)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_imports BOOLEAN DEFAULT true;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS allow_chat BOOLEAN DEFAULT true; -- 双重保险

-- 2. 预填充基础任务数据 (修复 MissionService 报错)
-- 既然客户端没有权限自动 Seed，我们直接在后端插入
INSERT INTO missions (id, title, description, type, reward_amount, target_count)
VALUES 
  ('daily_login', '每日登录', '登录游戏即可获得奖励', 'daily', 100, 1),
  ('daily_run_1km', '每日跑步1公里', '完成一次1公里的跑步', 'daily', 200, 1000),
  ('weekly_run_5km', '周常挑战', '本周累计跑步5公里', 'weekly', 500, 5000)
ON CONFLICT (id) DO NOTHING;

-- 3. 确保 missions 表可读
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read missions" ON missions FOR SELECT TO public USING (true);
