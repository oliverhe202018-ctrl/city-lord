-- Atomic Claim Mission Reward RPC
-- Returns the updated profile stats (coins, exp, level)
CREATE OR REPLACE FUNCTION claim_mission_reward_rpc(p_user_id UUID, p_mission_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission_status TEXT;
  v_reward_coins INT;
  v_reward_xp INT;
  v_current_coins INT;
  v_current_xp INT;
  v_current_level INT;
  v_new_coins INT;
  v_new_xp INT;
  v_new_level INT;
  v_mission_title TEXT;
BEGIN
  -- 1. Lock and Check Mission Status
  SELECT 
    um.status, 
    m.reward_coins, 
    m.reward_experience, 
    m.title
  INTO 
    v_mission_status, 
    v_reward_coins, 
    v_reward_xp, 
    v_mission_title
  FROM user_missions um
  JOIN missions m ON um.mission_id = m.id
  WHERE um.user_id = p_user_id 
  AND um.mission_id = p_mission_id
  FOR UPDATE OF um;

  IF v_mission_status IS NULL THEN
    RAISE EXCEPTION 'Mission not found';
  END IF;

  IF v_mission_status = 'claimed' THEN
    RAISE EXCEPTION 'Mission already claimed';
  END IF;

  IF v_mission_status != 'completed' THEN
    RAISE EXCEPTION 'Mission not completed (Current status: %)', v_mission_status;
  END IF;

  -- 2. Update Mission Status
  UPDATE user_missions
  SET 
    status = 'claimed', 
    updated_at = NOW()
  WHERE user_id = p_user_id 
  AND mission_id = p_mission_id;

  -- 3. Update Profile Rewards
  SELECT coins, current_exp, level INTO v_current_coins, v_current_xp, v_current_level
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  v_new_coins := COALESCE(v_current_coins, 0) + COALESCE(v_reward_coins, 0);
  v_new_xp := COALESCE(v_current_xp, 0) + COALESCE(v_reward_xp, 0);
  
  -- Simple Level Calculation (Example: Level = 1 + sqrt(xp/100))
  -- Or keep existing level if we don't have the formula here.
  -- Let's just increment XP and let the application handle levelup popup, 
  -- OR update level here if it crosses a threshold. 
  -- For safety, let's keep the level same unless we import the calc logic.
  -- But usually, we want the DB to be the source of truth.
  -- Let's assume a linear or simple exponential curve if we must, or just update XP.
  -- User prompt said: "Increment coins and experience... Return updated profile data."
  -- It didn't explicitly ask for level up logic in SQL, but it's good practice.
  -- For now, we update XP and Coins.
  
  UPDATE profiles
  SET 
    coins = v_new_coins,
    current_exp = v_new_xp,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- 4. Log Transaction (Optional but good)
  -- INSERT INTO transaction_history ...

  -- 5. Return Result
  RETURN jsonb_build_object(
    'success', true,
    'new_coins', v_new_coins,
    'new_experience', v_new_xp,
    'reward_coins', v_reward_coins,
    'reward_experience', v_reward_xp,
    'mission_title', v_mission_title
  );
END;
$$;
