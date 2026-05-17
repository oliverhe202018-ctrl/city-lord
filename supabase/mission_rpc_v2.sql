/*
 * ⚠️ DEPRECATED — 2026-05-10
 * 
 * 此 RPC 引用了已废弃的 current_exp 字段。
 * 任务奖励发放已统一迁移至 Node.js 层：
 *   lib/game-logic/reward-service.ts (grantRewards)
 * 
 * 如需清理数据库中的旧函数，请执行：
 *   DROP FUNCTION IF EXISTS claim_mission_reward_rpc(uuid, text) CASCADE;
 * 
 * 本文件保留为历史参考，严禁在生产环境执行。
 */

-- Atomic Claim Mission Reward RPC [DEPRECATED]
-- CREATE OR REPLACE FUNCTION claim_mission_reward_rpc(p_user_id UUID, p_mission_id TEXT)
-- RETURNS JSONB
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- DECLARE
--   v_mission_status TEXT;
--   v_reward_coins INT;
--   v_reward_xp INT;
--   v_current_coins INT;
--   v_current_xp INT;
--   v_current_level INT;
--   v_new_coins INT;
--   v_new_xp INT;
--   v_new_level INT;
--   v_mission_title TEXT;
-- BEGIN
--   SELECT 
--     um.status, 
--     m.reward_coins, 
--     m.reward_experience, 
--     m.title
--   INTO 
--     v_mission_status, 
--     v_reward_coins, 
--     v_reward_xp, 
--     v_mission_title
--   FROM user_missions um
--   JOIN missions m ON um.mission_id = m.id
--   WHERE um.user_id = p_user_id 
--   AND um.mission_id = p_mission_id
--   FOR UPDATE OF um;
--
--   IF v_mission_status IS NULL THEN
--     RAISE EXCEPTION 'Mission not found';
--   END IF;
--
--   IF v_mission_status = 'claimed' THEN
--     RAISE EXCEPTION 'Mission already claimed';
--   END IF;
--
--   IF v_mission_status != 'completed' THEN
--     RAISE EXCEPTION 'Mission not completed (Current status: %)', v_mission_status;
--   END IF;
--
--   UPDATE user_missions
--   SET 
--     status = 'claimed', 
--     updated_at = NOW()
--   WHERE user_id = p_user_id 
--   AND mission_id = p_mission_id;
--
--   SELECT coins, current_exp, level INTO v_current_coins, v_current_xp, v_current_level
--   FROM profiles
--   WHERE id = p_user_id
--   FOR UPDATE;
--
--   v_new_coins := COALESCE(v_current_coins, 0) + COALESCE(v_reward_coins, 0);
--   v_new_xp := COALESCE(v_current_xp, 0) + COALESCE(v_reward_xp, 0);
--   
--   UPDATE profiles
--   SET 
--     coins = v_new_coins,
--     current_exp = v_new_xp,
--     updated_at = NOW()
--   WHERE id = p_user_id;
--
--   RETURN jsonb_build_object(
--     'success', true,
--     'new_coins', v_new_coins,
--     'new_experience', v_new_xp,
--     'reward_coins', v_reward_coins,
--     'reward_experience', v_reward_xp,
--     'mission_title', v_mission_title
--   );
-- END;
-- $$;
