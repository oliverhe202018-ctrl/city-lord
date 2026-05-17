-- Seed default missions
INSERT INTO public.missions (id, title, description, type, target, reward_coins, reward_experience, frequency)
VALUES
  ('daily_jog', 'Daily Jog', 'Run 1km today', 'distance', 1, 100, 50, 'daily'),
  ('serious_runner', 'Serious Runner', 'Run 5km today', 'distance', 5, 300, 150, 'daily'),
  ('explorer', 'Explorer', 'Visit 5 unique hexes', 'UNIQUE_HEX', 5, 200, 100, 'daily'),
  ('night_owl', 'Night Owl', 'Complete a run between 10PM and 4AM', 'NIGHT_RUN', 1, 150, 75, 'daily'),
  ('marathon_week', 'Marathon Week', 'Run 42km this week', 'distance', 42, 1000, 500, 'weekly')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  type = EXCLUDED.type,
  target = EXCLUDED.target,
  reward_coins = EXCLUDED.reward_coins,
  reward_experience = EXCLUDED.reward_experience,
  frequency = EXCLUDED.frequency;
