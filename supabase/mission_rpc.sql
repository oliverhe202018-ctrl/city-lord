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

-- RPC: 领取任务奖励 (原子操作)
-- 包含：检查状态、更新状态、发放奖励、写入日志
create or replace function claim_mission_reward_rpc(
  target_mission_id text,
  reward_type text,
  reward_amount int,
  mission_title text
)
returns boolean
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  mission_status text;
  current_exp int;
  current_level int;
  current_max_exp int;
  current_coins int;
begin
  current_user_id := auth.uid();
  
  -- 1. 锁定并检查任务状态
  select status into mission_status 
  from user_missions 
  where user_id = current_user_id and mission_id = target_mission_id 
  for update;
  
  if mission_status is null then
    -- 如果任务不存在，尝试初始化 (针对一些还没写入数据库但前端已有的默认任务)
    -- 但通常应该是先有记录才能领取。这里假设如果不存在则不能领取，或者根据业务需求自动创建并标记为 claimed
    -- 为了安全，这里返回 false，要求必须先有 'completed' 状态的记录
    return false;
  end if;
  
  if mission_status = 'claimed' then
    return false; -- 已经领取过
  end if;
  
  if mission_status != 'completed' then
    return false; -- 任务未完成
  end if;
  
  -- 2. 更新任务状态为 'claimed'
  update user_missions 
  set status = 'claimed', updated_at = now()
  where user_id = current_user_id and mission_id = target_mission_id;
  
  -- 3. 发放奖励 (原子操作)
  if reward_type = 'xp' then
    -- 获取当前用户资料
    select current_exp, level, max_exp into current_exp, current_level, current_max_exp
    from profiles where id = current_user_id;
    
    current_exp := current_exp + reward_amount;
    
    -- 简单的升级逻辑 (也可以复用 add_user_experience 函数逻辑)
    while current_exp >= current_max_exp loop
      current_exp := current_exp - current_max_exp;
      current_level := current_level + 1;
    end loop;
    
    update profiles 
    set current_exp = current_exp, level = current_level, updated_at = now()
    where id = current_user_id;
    
  elsif reward_type = 'coins' then
    -- 假设 profiles 表有 coins 字段，如果没有需要添加
    -- 这里先检查列是否存在，或者假设存在。为了演示，我们先假设存在。
    -- 如果您的 profiles 表还没有 coins 字段，请先添加: ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins integer DEFAULT 0;
    update profiles 
    set coins = coalesce(coins, 0) + reward_amount, updated_at = now()
    where id = current_user_id;
  end if;
  
  -- 4. 写入系统消息
  insert into messages (sender_id, receiver_id, content, type, is_read)
  values (
    current_user_id, 
    current_user_id, 
    '恭喜！你完成了任务"' || mission_title || '"，获得 ' || reward_amount || (case when reward_type='xp' then '经验' else '金币' end) || '！',
    'system',
    false
  );
  
  return true;
end;
$$;
