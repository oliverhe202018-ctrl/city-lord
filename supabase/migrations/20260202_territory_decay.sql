-- 1. Modify Table territories
ALTER TABLE public.territories 
ADD COLUMN IF NOT EXISTS last_maintained_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS health INTEGER DEFAULT 100 CHECK (health >= 0 AND health <= 100),
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- 2. Create Decay Function
CREATE OR REPLACE FUNCTION decay_territories_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Decrease health by 10 for all territories where last_maintained_at is older than 24 hours
  UPDATE public.territories
  SET health = GREATEST(0, health - 10)
  WHERE last_maintained_at < NOW() - INTERVAL '24 hours';

  -- Reset territories where health <= 0
  -- Revert to neutral wilderness: owner_id to NULL, level to 1, health to 100
  UPDATE public.territories
  SET 
    owner_id = NULL,
    level = 1,
    health = 100,
    captured_at = NULL -- Optional: clear captured_at as it is now neutral
  WHERE health <= 0;
END;
$$;

-- 3. Create Claim Logic RPC
CREATE OR REPLACE FUNCTION claim_territory(
  p_city_id TEXT,
  p_cell_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_owner UUID;
  v_user_id UUID;
  v_result TEXT;
BEGIN
  v_user_id := auth.uid();
  if v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check current owner
  SELECT owner_id INTO v_current_owner
  FROM public.territories
  WHERE id = p_cell_id; -- id is the PK (H3 index)

  IF v_current_owner = v_user_id THEN
    -- Repair/Reinforce
    UPDATE public.territories
    SET 
      health = 100,
      last_maintained_at = NOW()
    WHERE id = p_cell_id;
    v_result := 'repaired';
  ELSE
    -- Capture (Upsert)
    INSERT INTO public.territories (id, city_id, owner_id, captured_at, health, last_maintained_at, level)
    VALUES (p_cell_id, p_city_id, v_user_id, NOW(), 100, NOW(), 1)
    ON CONFLICT (id) DO UPDATE
    SET 
      owner_id = EXCLUDED.owner_id,
      captured_at = NOW(),
      health = 100,
      last_maintained_at = NOW(),
      city_id = EXCLUDED.city_id; -- Ensure city_id is correct
      
    v_result := 'captured';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', v_result,
    'cell_id', p_cell_id
  );
END;
$$;

-- 4. Scheduled Job (Requires pg_cron extension)
-- Note: You must enable pg_cron extension in Supabase Dashboard -> Database -> Extensions
-- Then run this:
-- SELECT cron.schedule(
--   'decay-territories-daily', -- name of the cron job
--   '0 0 * * *', -- every day at midnight
--   'SELECT decay_territories_daily()'
-- );
