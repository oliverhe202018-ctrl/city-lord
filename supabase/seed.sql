-- ==============================================================================
-- 1. Insert Initial Badges (Definitions)
-- ==============================================================================
INSERT INTO public.badges (code, name, description, icon_name, category, condition_value, tier)
VALUES
  ('first_step', 'First Step', 'Capture your first hex', 'footprints', 'exploration', 1, 'bronze'),
  ('explorer', 'Explorer', 'Capture 50 hexes', 'map', 'exploration', 50, 'silver'),
  ('runner', 'Runner', 'Run 10km total', 'person-running', 'endurance', 10, 'bronze'),
  ('marathoner', 'Marathoner', 'Run 42km total', 'medal', 'endurance', 42, 'gold')
ON CONFLICT (code) DO NOTHING;

-- ==============================================================================
-- 2. Insert Achievements (Logic Layer - mirroring Badges)
-- ==============================================================================
INSERT INTO public.achievements (name, description, type, tier, condition_type, condition_threshold, reward_badge, reward_exp, reward_points)
VALUES
  ('First Step', 'Capture your first hex', 'exploration', 1, 'tiles_captured', 1, 'first_step', 100, 10),
  ('Explorer', 'Capture 50 hexes', 'exploration', 2, 'tiles_captured', 50, 'explorer', 500, 50),
  ('Runner', 'Run 10km total', 'endurance', 1, 'total_distance', 10, 'runner', 200, 20),
  ('Marathoner', 'Run 42km total', 'endurance', 3, 'total_distance', 42, 'marathoner', 1000, 100)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 3. Insert Daily/Weekly Missions
-- ==============================================================================
INSERT INTO public.missions (title, description, type, target, reward_coins, reward_experience, frequency)
VALUES
  ('Morning Jog', 'Run 1km', 'distance', 1, 100, 50, 'daily'),
  ('Territory Scout', 'Visit 3 hexes', 'exploration', 3, 50, 30, 'daily'),
  ('Distance Challenge', 'Run 10km total', 'distance', 10, 500, 200, 'weekly')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 4. Create User Initialization Function (RPC)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.init_user_game_data(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Insert user_missions for all active missions (daily/weekly)
  --    We use 'in-progress' to represent the requested 'ongoing' status (mapped to DB enum)
  INSERT INTO public.user_missions (user_id, mission_id, status, progress, updated_at)
  SELECT 
    target_user_id, 
    id, 
    'in-progress', 
    0, 
    now()
  FROM public.missions
  WHERE frequency IN ('daily', 'weekly')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_missions
    WHERE user_id = target_user_id AND mission_id = missions.id
  );

  -- 2. Optional: Check for auto-granting badges (e.g. if user already has stats)
  --    This is a placeholder. In a real scenario, you might query user_city_progress
  --    or profiles to see if they already meet criteria, then insert into user_badges.
  --    For new users, this is typically skipped as stats are 0.
END;
$$;
