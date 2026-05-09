-- USER MISSIONS
create table if not exists user_missions (
  user_id uuid references profiles(id) on delete cascade,
  mission_id text not null,
  status text default 'active' check (status in ('locked', 'active', 'completed', 'claimed')),
  progress integer default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, mission_id)
);

-- RLS for User Missions
alter table user_missions enable row level security;

create policy "Users can read own missions" on user_missions for select
  using (auth.uid() = user_id);

create policy "Users can update own missions" on user_missions for update
  using (auth.uid() = user_id);

create policy "Users can insert own missions" on user_missions for insert
  with check (auth.uid() = user_id);

/*
 * ⚠️ DEPRECATED — 2026-05-10
 * 
 * 此 RPC 引用了已废弃的 current_exp / max_exp 字段。
 * 任务奖励发放已统一迁移至 Node.js 层：
 *   lib/game-logic/reward-service.ts (grantRewards)
 * 
 * 如需清理数据库中的旧函数，请执行：
 *   DROP FUNCTION IF EXISTS claim_mission_reward_rpc(text, text, int, text) CASCADE;
 * 
 * 本文件保留为历史参考，严禁在生产环境执行。
 */

-- RPC: 领取任务奖励 (原子操作) [DEPRECATED]
-- create or replace function claim_mission_reward_rpc(
--   target_mission_id text,
--   reward_type text,
--   reward_amount int,
--   mission_title text
-- )
-- returns boolean
-- language plpgsql
-- security definer
-- as $$
-- declare
--   current_user_id uuid;
--   mission_status text;
--   current_exp int;
--   current_level int;
--   current_max_exp int;
--   current_coins int;
-- begin
--   current_user_id := auth.uid();
--   
--   select status into mission_status 
--   from user_missions 
--   where user_id = current_user_id and mission_id = target_mission_id 
--   for update;
--   
--   if mission_status is null then
--     return false;
--   end if;
--   
--   if mission_status = 'claimed' then
--     return false;
--   end if;
--   
--   if mission_status != 'completed' then
--     return false;
--   end if;
--   
--   update user_missions 
--   set status = 'claimed', updated_at = now()
--   where user_id = current_user_id and mission_id = target_mission_id;
--   
--   if reward_type = 'xp' then
--     select current_exp, level, max_exp into current_exp, current_level, current_max_exp
--     from profiles where id = current_user_id;
--     
--     current_exp := current_exp + reward_amount;
--     
--     while current_exp >= current_max_exp loop
--       current_exp := current_exp - current_max_exp;
--       current_level := current_level + 1;
--     end loop;
--     
--     update profiles 
--     set current_exp = current_exp, level = current_level, updated_at = now()
--     where id = current_user_id;
--     
--   elsif reward_type = 'coins' then
--     update profiles 
--     set coins = coalesce(coins, 0) + reward_amount, updated_at = now()
--     where id = current_user_id;
--   end if;
--   
--   insert into messages (sender_id, receiver_id, content, type, is_read)
--   values (
--     current_user_id, 
--     current_user_id, 
--     '恭喜！你完成了任务"' || mission_title || '"，获得 ' || reward_amount || (case when reward_type='xp' then '经验' else '金币' end) || '！',
--     'system',
--     false
--   );
--   
--   return true;
-- end;
-- $$;
