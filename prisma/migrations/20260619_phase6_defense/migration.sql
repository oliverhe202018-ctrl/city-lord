-- Phase 6: GIS 精度修正 + 死锁消除 + 时间窗保护

-- 1. 修正 attack_territory 的 ST_Distance 计算，确保 SRID 显式声明
CREATE OR REPLACE FUNCTION attack_territory(
  p_attacker_id UUID,
  p_territory_id TEXT,
  p_attacker_lat DOUBLE PRECISION,
  p_attacker_lng DOUBLE PRECISION,
  p_damage INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_territory territories%ROWTYPE;
  v_distance_m DOUBLE PRECISION;
  v_new_shield INTEGER;
  v_new_hp INTEGER;
  v_new_health INTEGER;
  v_captured BOOLEAN := FALSE;
BEGIN
  -- 1. ACQUIRE ROW-LEVEL LOCK
  SELECT * INTO v_territory
  FROM territories
  WHERE id = p_territory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TERRITORY_NOT_FOUND');
  END IF;

  -- 2. [P6] SRID 4326 → geography 精确距离（米）
  v_distance_m := ST_Distance(
    ST_SetSRID(ST_MakePoint(p_attacker_lng, p_attacker_lat), 4326)::geography,
    ST_SetSRID(ST_Centroid(v_territory.geojson), 4326)::geography
  );

  IF v_distance_m > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'OUT_OF_RANGE', 'distance', v_distance_m, 'max_allowed', 100);
  END IF;

  -- 3. CALCULATE NEW SHIELD & HP
  v_new_shield := GREATEST(0, v_territory.shield - p_damage);
  v_new_hp := v_territory.current_hp;
  IF v_territory.shield < p_damage THEN
    v_new_hp := GREATEST(0, v_territory.current_hp - (p_damage - v_territory.shield));
  END IF;
  v_new_health := ROUND((v_new_hp::NUMERIC / v_territory.max_hp) * 100);

  -- 4. CHECK IF TERRITORY CAPTURED
  IF v_new_hp <= 0 THEN
    v_captured := TRUE;
    UPDATE territories
    SET owner_id = p_attacker_id, shield = 0, current_hp = 1000, health = 100,
        last_attacked_at = NOW(), captured_at = NOW(),
        owner_change_count = owner_change_count + 1
    WHERE id = p_territory_id;

    INSERT INTO territory_events (territory_id, event_type, user_id, old_owner_id, new_owner_id, damage_value, before_hp, after_hp, payload_json)
    VALUES (p_territory_id, 'CAPTURED', p_attacker_id, v_territory.owner_id, p_attacker_id, p_damage, v_territory.current_hp, 1000,
      jsonb_build_object('attacker_distance', v_distance_m, 'previous_owner', v_territory.owner_id));

    PERFORM pg_notify('territory_changes', jsonb_build_object('event', 'territory_captured', 'territory_id', p_territory_id, 'new_owner', p_attacker_id, 'timestamp', NOW())::text);

    RETURN jsonb_build_object('success', true, 'captured', true, 'new_owner', p_attacker_id);
  END IF;

  -- 5. UPDATE TERRITORY (damage without capture)
  UPDATE territories
  SET shield = v_new_shield, current_hp = v_new_hp, health = v_new_health, last_attacked_at = NOW()
  WHERE id = p_territory_id;

  INSERT INTO territory_events (territory_id, event_type, user_id, damage_value, before_hp, after_hp, payload_json)
  VALUES (p_territory_id, 'ATTACKED', p_attacker_id, p_damage, v_territory.current_hp, v_new_hp,
    jsonb_build_object('attacker_distance', v_distance_m, 'shield_before', v_territory.shield, 'shield_after', v_new_shield));

  PERFORM pg_notify('territory_changes', jsonb_build_object('event', 'territory_damaged', 'territory_id', p_territory_id, 'damage', p_damage, 'remaining_hp', v_new_hp, 'timestamp', NOW())::text);

  RETURN jsonb_build_object('success', true, 'captured', false, 'remaining_hp', v_new_hp, 'remaining_shield', v_new_shield, 'health', v_new_health);
END;
$$;
