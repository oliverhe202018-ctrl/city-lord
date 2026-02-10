-- Enable pg_cron if not already enabled (Requires Superuser)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Monthly Reset Job (Runs at 00:00 on 1st of every month)
-- Note: In Supabase, you schedule this via SQL Editor or Dashboard

/*
SELECT cron.schedule(
  'monthly_season_reset',
  '0 0 1 * *', -- At 00:00 on day-of-month 1
  $$
    -- 1. Archive Current Season Stats (Conceptually, or just freeze them)
    -- Here we assume we just start a new season and deactivate old one
    
    -- 2. Deactivate old seasons
    UPDATE seasons SET is_active = false WHERE is_active = true;
    
    -- 3. Create New Season
    INSERT INTO seasons (name, start_date, end_date, is_active)
    VALUES (
      to_char(now(), 'YYYY-MM') || ' Season',
      now(),
      now() + interval '1 month' - interval '1 second',
      true
    );
    
    -- 4. Reset Fog (Optional - maybe keep exploration?)
    -- UPDATE user_city_progress SET fog_level = 1; -- Example
    
    -- 5. Notify Users (via specialized table or webhook)
  $$
);
*/

-- Function to calculate season rewards
CREATE OR REPLACE FUNCTION calculate_season_rewards(season_uuid uuid) RETURNS void AS $$
BEGIN
  -- Insert badges for Top 100
  INSERT INTO user_badges (user_id, badge_id, acquired_at)
  SELECT user_id, 'season_top_100', now()
  FROM user_season_stats
  WHERE season_id = season_uuid
  ORDER BY score DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql;
