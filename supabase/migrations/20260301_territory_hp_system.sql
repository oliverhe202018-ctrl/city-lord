-- ============================================================
-- Territory HP System Migration
-- Date: 2026-03-01
-- Description: Extends territory health from 0-100 to 0-1000,
--   adds HP attack logs with daily limit, and score field.
-- ============================================================

-- ============================================================
-- STEP 0: Pre-migration backup & metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS public._territories_backup_20260301 AS
  SELECT * FROM public.territories;

DO $$
DECLARE
  v_count INT;
  v_sum   BIGINT;
  v_max   INT;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(health), 0), COALESCE(MAX(health), 0)
    INTO v_count, v_sum, v_max
    FROM public.territories;
  RAISE NOTICE 'PRE-MIGRATION: count=%, health_sum=%, max=%', v_count, v_sum, v_max;
END $$;

-- ============================================================
-- STEP 1: Expand territories.health from 0-100 to 0-1000
-- ============================================================

-- Drop old constraint
ALTER TABLE public.territories DROP CONSTRAINT IF EXISTS territories_health_check;

-- Scale existing data: health * 10  (e.g. 100 -> 1000, 50 -> 500)
UPDATE public.territories SET health = COALESCE(health, 100) * 10;

-- Set new default and constraint
ALTER TABLE public.territories ALTER COLUMN health SET DEFAULT 1000;
ALTER TABLE public.territories ADD CONSTRAINT territories_health_check
  CHECK (health >= 0 AND health <= 1000);

-- ============================================================
-- STEP 2: Add ownership tracking columns to territories
-- ============================================================
ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS owner_change_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_owner_change_at TIMESTAMPTZ;

-- ============================================================
-- STEP 3: Create territory_hp_logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.territory_hp_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id  TEXT NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  attacker_id   UUID NOT NULL,
  damage        INT NOT NULL,
  attacked_at   TIMESTAMPTZ DEFAULT NOW(),
  attack_date   DATE NOT NULL DEFAULT CURRENT_DATE
);

-- Each player can only attack the same territory once per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_hp_logs_daily_limit
  ON public.territory_hp_logs(territory_id, attacker_id, attack_date);

-- Fast lookup by territory
CREATE INDEX IF NOT EXISTS idx_hp_logs_territory
  ON public.territory_hp_logs(territory_id);

-- RLS
ALTER TABLE public.territory_hp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HP logs viewable by everyone"
  ON public.territory_hp_logs FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert HP logs"
  ON public.territory_hp_logs FOR INSERT
  WITH CHECK (auth.uid() = attacker_id);

-- ============================================================
-- STEP 4: Add score field to user_city_progress
-- ============================================================
ALTER TABLE public.user_city_progress
  ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;

-- Performance indexes for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_ucp_score
  ON public.user_city_progress(city_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_ucp_area
  ON public.user_city_progress(city_id, area_controlled DESC);

-- ============================================================
-- STEP 5: Add neutral_until cooldown field
-- ============================================================
ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS neutral_until TIMESTAMPTZ;

-- ============================================================
-- STEP 6: Create territory_owner_change_logs for strict window counting
-- ============================================================
-- Only records real ownership transfers (A→B), NOT A→neutral.
-- Used by hotzone-service to precisely count changes within 7-day window.
CREATE TABLE IF NOT EXISTS public.territory_owner_change_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id    TEXT NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  previous_owner  UUID,
  new_owner       UUID NOT NULL,
  changed_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ocl_territory_time
  ON public.territory_owner_change_logs(territory_id, changed_at DESC);

ALTER TABLE public.territory_owner_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner change logs viewable by everyone"
  ON public.territory_owner_change_logs FOR SELECT USING (true);

-- ============================================================
-- STEP 7: Update decay function for HP 1000 scale + neutral_until
-- ============================================================
CREATE OR REPLACE FUNCTION decay_territories_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hp_deleted INT;
  v_ocl_deleted INT;
BEGIN
  -- Decrease health by 100 (10% of 1000) for un-maintained territories
  UPDATE public.territories
  SET health = GREATEST(0, health - 100)
  WHERE last_maintained_at < NOW() - INTERVAL '24 hours';

  -- Territories with 0 health become neutral (with 5-min cooldown)
  UPDATE public.territories
  SET
    owner_id = NULL,
    level = 1,
    health = 1000,
    captured_at = NULL,
    owner_change_count = COALESCE(owner_change_count, 0) + 1,
    last_owner_change_at = NOW(),
    neutral_until = NOW() + INTERVAL '5 minutes'
  WHERE health <= 0;

  -- Dynamic hp_logs cleanup:
  --   Hot territories (change_count >= 2): keep 72 hours for analysis
  --   Normal territories: keep 48 hours (daily-limit purpose only)
  DELETE FROM public.territory_hp_logs
  WHERE (
    attack_date < CURRENT_DATE - 1
    AND territory_id NOT IN (
      SELECT id FROM public.territories
      WHERE owner_change_count >= 2
    )
  ) OR (
    attack_date < CURRENT_DATE - 2
  );
  GET DIAGNOSTICS v_hp_deleted = ROW_COUNT;

  -- Clean owner change logs older than 8 days (beyond the 7-day window)
  DELETE FROM public.territory_owner_change_logs
  WHERE changed_at < NOW() - INTERVAL '8 days';
  GET DIAGNOSTICS v_ocl_deleted = ROW_COUNT;

  -- Monitoring: log cleanup counts
  RAISE NOTICE 'decay_territories_daily: hp_logs_deleted=%, ocl_deleted=%', v_hp_deleted, v_ocl_deleted;
END;
$$;


-- ============================================================
-- STEP 8: Post-migration consistency verification
-- ============================================================
DO $$
DECLARE
  v_count INT;
  v_sum   BIGINT;
  v_max   INT;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(health), 0), COALESCE(MAX(health), 0)
    INTO v_count, v_sum, v_max
    FROM public.territories;
  RAISE NOTICE 'POST-MIGRATION: count=%, health_sum=%, max=%', v_count, v_sum, v_max;
  -- Expected: health_sum should be exactly 10x the pre-migration value
END $$;

