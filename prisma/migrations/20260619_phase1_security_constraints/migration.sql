-- Phase 1: Database Constraints, RLS & Atomic Transactions
-- Created: 2026-06-19
-- Purpose: Prevent cheating, race conditions, and data corruption

-- ============================================================
-- 1. NUMERIC INTEGRITY CHECK CONSTRAINTS
-- ============================================================

-- Prevent crit_rate manipulation (must be 0-1 range)
ALTER TABLE profiles 
ADD CONSTRAINT check_crit_rate 
CHECK (crit_rate >= 0 AND crit_rate <= 1);

-- Prevent shield overflow/underflow (0-1000 range)
ALTER TABLE territories 
ADD CONSTRAINT check_shield_range 
CHECK (shield >= 0 AND shield <= 1000);

-- Prevent negative HP values
ALTER TABLE territories 
ADD CONSTRAINT check_current_hp_non_negative 
CHECK (current_hp >= 0);

ALTER TABLE territories 
ADD CONSTRAINT check_max_hp_positive 
CHECK (max_hp > 0);

-- ============================================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on territories table
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;

-- Policy: Block direct client updates to sensitive fields
-- Only service_role (via RPC functions) can modify owner_id, shield, current_hp
CREATE POLICY "territories_no_direct_update" ON territories
FOR UPDATE
USING (
  -- Allow only service_role (bypass RLS for server-side RPC functions)
  current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
);

-- Policy: Allow authenticated users to SELECT territories
CREATE POLICY "territories_select_authenticated" ON territories
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow service_role to INSERT (for settlement logic)
CREATE POLICY "territories_insert_service_role" ON territories
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================
-- 3. ATOMIC ATTACK RPC FUNCTION (with FOR UPDATE lock)
-- ============================================================

CREATE OR REPLACE FUNCTION attack_territory(
  p_attacker_id UUID,
  p_territory_id TEXT,
  p_attacker_lat DOUBLE PRECISION,
  p_attacker_lng DOUBLE PRECISION,
  p_damage INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as service_role to bypass RLS
AS $$
DECLARE
  v_territory territories%ROWTYPE;
  v_distance_m DOUBLE PRECISION;
  v_new_shield INTEGER;
  v_new_hp INTEGER;
  v_new_health INTEGER;
  v_captured BOOLEAN := FALSE;
BEGIN
  -- 1. ACQUIRE ROW-LEVEL LOCK (FOR UPDATE prevents race conditions)
  SELECT * INTO v_territory 
  FROM territories 
  WHERE id = p_territory_id 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TERRITORY_NOT_FOUND');
  END IF;

  -- 2. POSTGIS DISTANCE VALIDATION (attacker must be within 100m of territory centroid)
  v_distance_m := ST_Distance(
    ST_SetSRID(ST_MakePoint(p_attacker_lng, p_attacker_lat), 4326)::geography,
    ST_SetSRID(ST_Centroid(v_territory.geojson), 4326)::geography
  );
  
  IF v_distance_m > 100 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'OUT_OF_RANGE', 
      'distance', v_distance_m,
      'max_allowed', 100
    );
  END IF;

  -- 3. CALCULATE NEW SHIELD & HP (shield absorbs damage first)
  v_new_shield := GREATEST(0, v_territory.shield - p_damage);
  v_new_hp := v_territory.current_hp;
  
  -- If shield was insufficient, overflow damage to HP
  IF v_territory.shield < p_damage THEN
    v_new_hp := GREATEST(0, v_territory.current_hp - (p_damage - v_territory.shield));
  END IF;
  
  -- Calculate health percentage (0-100)
  v_new_health := ROUND((v_new_hp::NUMERIC / v_territory.max_hp) * 100);

  -- 4. CHECK IF TERRITORY CAPTURED (HP <= 0)
  IF v_new_hp <= 0 THEN
    v_captured := TRUE;
    
    -- Transfer ownership to attacker
    UPDATE territories
    SET 
      owner_id = p_attacker_id,
      shield = 0,
      current_hp = 1000, -- Reset to full HP
      health = 100,
      last_attacked_at = NOW(),
      captured_at = NOW(),
      owner_change_count = owner_change_count + 1
    WHERE id = p_territory_id;
    
    -- Log territory capture event
    INSERT INTO territory_events (
      territory_id, event_type, user_id, 
      old_owner_id, new_owner_id, damage_value,
      before_hp, after_hp, payload_json
    ) VALUES (
      p_territory_id, 'CAPTURED', p_attacker_id,
      v_territory.owner_id, p_attacker_id, p_damage,
      v_territory.current_hp, 1000,
      jsonb_build_object(
        'attacker_distance', v_distance_m,
        'previous_owner', v_territory.owner_id
      )
    );
    
    -- 5. REALTIME BROADCAST (notify all connected clients)
    PERFORM pg_notify(
      'territory_changes',
      jsonb_build_object(
        'event', 'territory_captured',
        'territory_id', p_territory_id,
        'new_owner', p_attacker_id,
        'timestamp', NOW()
      )::text
    );
    
    RETURN jsonb_build_object(
      'success', true, 
      'captured', true,
      'new_owner', p_attacker_id
    );
  END IF;

  -- 6. UPDATE TERRITORY (damage without capture)
  UPDATE territories
  SET 
    shield = v_new_shield,
    current_hp = v_new_hp,
    health = v_new_health,
    last_attacked_at = NOW()
  WHERE id = p_territory_id;
  
  -- Log attack event
  INSERT INTO territory_events (
    territory_id, event_type, user_id, 
    damage_value, before_hp, after_hp, payload_json
  ) VALUES (
    p_territory_id, 'ATTACKED', p_attacker_id,
    p_damage, v_territory.current_hp, v_new_hp,
    jsonb_build_object(
      'attacker_distance', v_distance_m,
      'shield_before', v_territory.shield,
      'shield_after', v_new_shield
    )
  );
  
  -- Broadcast damage event
  PERFORM pg_notify(
    'territory_changes',
    jsonb_build_object(
      'event', 'territory_damaged',
      'territory_id', p_territory_id,
      'damage', p_damage,
      'remaining_hp', v_new_hp,
      'timestamp', NOW()
    )::text
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'captured', false,
    'remaining_hp', v_new_hp,
    'remaining_shield', v_new_shield,
    'health', v_new_health
  );
END;
$$;

-- ============================================================
-- 4. PG_CRON SCHEDULED TASKS
-- ============================================================

-- Task 1: Shield decay (5% per hour)
SELECT cron.schedule(
  'shield-decay-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  UPDATE territories
  SET shield = GREATEST(0, shield - FLOOR(shield * 0.05)::INTEGER)
  WHERE shield > 0 AND status = 'ACTIVE';
  $$
);

-- Task 2: Territory coin production (area-weighted, hourly)
-- Formula: area_m2 / 10000 * 0.1 coins per m²
SELECT cron.schedule(
  'territory-coin-output',
  '5 * * * *', -- Every hour at minute 5
  $$
  UPDATE user_wallets w
  SET sweat_coins = sweat_coins + COALESCE(subquery.total_coins, 0)
  FROM (
    SELECT 
      t.owner_id,
      SUM(FLOOR(t.area_m2_exact / 10000 * 0.1 * t.score_weight))::BIGINT AS total_coins
    FROM territories t
    WHERE t.status = 'ACTIVE' AND t.owner_id IS NOT NULL
    GROUP BY t.owner_id
  ) subquery
  WHERE w.user_id = subquery.owner_id;
  $$
);

-- Task 3: HP regeneration (1% per hour for territories not attacked in 24h)
SELECT cron.schedule(
  'hp-regeneration-hourly',
  '10 * * * *', -- Every hour at minute 10
  $$
  UPDATE territories
  SET 
    current_hp = LEAST(max_hp, current_hp + FLOOR(max_hp * 0.01)::INTEGER),
    health = LEAST(100, ROUND((current_hp + FLOOR(max_hp * 0.01)::INTEGER)::NUMERIC / max_hp * 100))
  WHERE 
    status = 'ACTIVE' 
    AND current_hp < max_hp
    AND (last_attacked_at IS NULL OR last_attacked_at < NOW() - INTERVAL '24 hours');
  $$
);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
