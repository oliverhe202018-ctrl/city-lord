-- Update existing Weekly Runner
UPDATE public.missions 
SET reward_experience = 800, frequency = 'weekly'
WHERE id = 'weekly_dist_15';

-- Insert new missions
INSERT INTO public.missions (id, title, description, type, target, reward_coins, reward_experience, frequency)
VALUES
  ('weekly_run_5', '坚持不懈', '本周累计完成5次跑步', 'RUN_COUNT', 5, 80, 600, 'weekly'),
  ('weekly_explorer_20', '城市探险', '本周探索20个新地块', 'UNIQUE_HEX', 20, 150, 700, 'weekly')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  target = EXCLUDED.target,
  reward_coins = EXCLUDED.reward_coins,
  reward_experience = EXCLUDED.reward_experience,
  frequency = EXCLUDED.frequency;
