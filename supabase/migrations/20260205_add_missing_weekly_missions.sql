INSERT INTO public.missions (id, title, description, type, target, reward_coins, reward_experience, frequency)
VALUES
  ('weekly_hex_50', '领地大亨', '本周占领或访问50个地块', 'HEX_COUNT', 50, 150, 600, 'weekly'),
  ('weekly_calories_1000', '燃烧吧卡路里', '本周累计消耗1000千卡', 'CALORIES', 1000, 120, 500, 'weekly')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  target = EXCLUDED.target,
  reward_coins = EXCLUDED.reward_coins,
  reward_experience = EXCLUDED.reward_experience,
  frequency = EXCLUDED.frequency;
