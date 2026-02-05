-- ==========================================
-- Task 1: Fix Realtime Chat (Enable Replication)
-- ==========================================

-- Enable Realtime for room_messages table
-- This allows the frontend to receive subscription events for new messages
ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;

-- Verify (Optional): Check if the table is added
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';


-- ==========================================
-- Task 2: Fix "Mission FK Violation" (Seed Missions)
-- ==========================================

-- Populate the 'missions' table with the default definitions found in mission-service.ts
-- Uses ON CONFLICT to be safe (idempotent) if you run it multiple times.

INSERT INTO missions (id, title, description, type, target, reward_coins, reward_experience, frequency)
VALUES
  -- Daily Missions
  ('daily_run_1', '每日开跑', '完成一次任意距离的跑步', 'RUN_COUNT', 1, 10, 50, 'daily'),
  ('daily_dist_3', '每日3公里', '单日累计跑步距离达到3公里', 'DISTANCE', 3000, 30, 100, 'daily'),
  ('daily_hex_10', '领地扩张', '单日占领或访问10个地块', 'HEX_COUNT', 10, 20, 80, 'daily'),

  -- Weekly Missions
  ('weekly_dist_15', '周跑者', '本周累计跑步15公里', 'DISTANCE', 15000, 100, 800, 'weekly'),
  ('weekly_run_5', '坚持不懈', '本周累计完成5次跑步', 'RUN_COUNT', 5, 80, 600, 'weekly'),
  ('weekly_explorer_20', '城市探险', '本周探索20个新地块', 'UNIQUE_HEX', 20, 150, 700, 'weekly'),
  ('weekly_night_3', '夜行侠', '本周完成3次夜跑（22:00-04:00）', 'NIGHT_RUN', 3, 80, 400, 'weekly'),
  ('weekly_active_3', '活跃跑者', '本周累计跑步3天', 'ACTIVE_DAYS', 3, 50, 300, 'weekly'),
  ('weekly_hex_50', '领地大亨', '本周占领或访问50个地块', 'HEX_COUNT', 50, 150, 600, 'weekly'),
  ('weekly_calories_1000', '燃烧吧卡路里', '本周累计消耗1000千卡', 'CALORIES', 1000, 120, 500, 'weekly'),

  -- Achievements
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
