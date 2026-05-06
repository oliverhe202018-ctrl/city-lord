-- ============================================================
-- Push Notification: device_tokens + webhook event tables
-- ============================================================

-- 1. device_tokens: 存储每个用户的 FCM 推送 token
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  token text NOT NULL,
  platform text CHECK (platform IN ('ios', 'android')),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own tokens" ON public.device_tokens
  FOR ALL USING (user_id = auth.uid());

-- 2. territory_attacks: 领地被攻击事件日志
-- Webhook INSERT → 触发 Edge Function 通知 defender_id
CREATE TABLE IF NOT EXISTS public.territory_attacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id text NOT NULL,
  territory_name text,
  attacker_id uuid REFERENCES auth.users NOT NULL,
  defender_id uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.territory_attacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "territory_attacks_select" ON public.territory_attacks
  FOR SELECT USING (attacker_id = auth.uid() OR defender_id = auth.uid());

CREATE POLICY "territory_attacks_insert" ON public.territory_attacks
  FOR INSERT WITH CHECK (attacker_id = auth.uid());

-- 3. mission_completions: 任务完成事件日志
-- Webhook INSERT → 触发 Edge Function 通知 user_id
CREATE TABLE IF NOT EXISTS public.mission_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  mission_id text NOT NULL,
  mission_title text,
  completed_at timestamptz DEFAULT now()
);

ALTER TABLE public.mission_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mission_completions_select" ON public.mission_completions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "mission_completions_insert" ON public.mission_completions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Database Webhooks 配置说明（需在 Supabase Dashboard 手动配置）
-- ============================================================
--
-- 【重要】territory_attacks 和 mission_completions 是本迁移新建的表，
-- 业务代码需要在以下时机写入：
--
--   territory_attacks:
--     当玩家成功攻击/占领他人领地时，由领地占领 API 写入一条记录。
--     字段：territory_id, territory_name, attacker_id, defender_id
--
--   mission_completions:
--     当玩家完成任务时，由任务完成 API 写入一条记录。
--     字段：user_id, mission_id, mission_title
--
-- ============================================================
--
-- Webhook 1: territory_attacks INSERT
--   Table: public.territory_attacks
--   Events: INSERT
--   Type: Supabase Edge Function
--   Function: send-push-notification
--   HTTP Headers: Authorization: Bearer <WEBHOOK_SECRET>
--   说明: 通知被攻击方 (defender_id)
--
-- Webhook 2: messages INSERT
--   Table: public.messages
--   Events: INSERT  
--   Type: Supabase Edge Function
--   Function: send-push-notification
--   HTTP Headers: Authorization: Bearer <WEBHOOK_SECRET>
--   说明: 通知消息接收方 (user_id)
--
-- Webhook 3: mission_completions INSERT
--   Table: public.mission_completions
--   Events: INSERT
--   Type: Supabase Edge Function
--   Function: send-push-notification
--   HTTP Headers: Authorization: Bearer <WEBHOOK_SECRET>
--   说明: 通知完成任务的用户 (user_id)
--
-- ============================================================
