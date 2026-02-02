-- 1. 增加经验值 (原子操作)
-- 如果经验值超过上限，会自动升级 (简易逻辑：每1000经验升1级，溢出经验保留)
-- 注意：这里假设 max_exp 固定为 1000，如果不同等级不同，需要查表
create or replace function add_user_experience(amount int)
returns json
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  new_exp int;
  new_level int;
  current_max_exp int;
  user_profile profiles%ROWTYPE;
begin
  current_user_id := auth.uid();
  
  -- 锁定行并获取当前状态
  select * into user_profile from profiles where id = current_user_id for update;
  
  new_exp := user_profile.current_exp + amount;
  new_level := user_profile.level;
  current_max_exp := user_profile.max_exp;
  
  -- 简单的升级循环
  while new_exp >= current_max_exp loop
    new_exp := new_exp - current_max_exp;
    new_level := new_level + 1;
    -- 这里可以添加 max_exp 的增长逻辑，暂时保持不变
  end loop;
  
  update profiles
  set 
    current_exp = new_exp,
    level = new_level,
    updated_at = now()
  where id = current_user_id;
  
  return json_build_object(
    'level', new_level,
    'current_exp', new_exp,
    'max_exp', current_max_exp,
    'leveled_up', new_level > user_profile.level
  );
end;
$$;

-- 2. 消耗体力 (原子操作)
create or replace function consume_user_stamina(amount int)
returns boolean
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  current_stamina int;
begin
  current_user_id := auth.uid();
  
  -- 检查体力是否足够
  select stamina into current_stamina from profiles where id = current_user_id;
  
  if current_stamina < amount then
    return false;
  end if;
  
  update profiles
  set 
    stamina = stamina - amount,
    updated_at = now()
  where id = current_user_id;
  
  return true;
end;
$$;

-- 3. 恢复体力 (原子操作)
create or replace function restore_user_stamina(amount int)
returns int
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  new_stamina int;
begin
  current_user_id := auth.uid();
  
  update profiles
  set 
    stamina = least(max_stamina, stamina + amount),
    updated_at = now()
  where id = current_user_id
  returning stamina into new_stamina;
  
  return new_stamina;
end;
$$;

-- 4. 增加领地面积 (原子操作)
create or replace function add_user_area(amount numeric)
returns numeric
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
  new_area numeric;
begin
  current_user_id := auth.uid();
  
  update profiles
  set 
    total_area = total_area + amount,
    updated_at = now()
  where id = current_user_id
  returning total_area into new_area;
  
  return new_area;
end;
$$;

-- 5. 增加用户属性 (原子操作 - 通用)
-- 用于任务奖励发放，同时增加经验和金币
create or replace function increment_user_stats(
  p_user_id uuid,
  p_xp int,
  p_coins int
)
returns void
language plpgsql
security definer
as $$
declare
  current_exp int;
  current_level int;
  current_max_exp int;
  user_profile profiles%ROWTYPE;
begin
  -- 锁定行
  select * into user_profile from profiles where id = p_user_id for update;
  
  if not found then
    return;
  end if;

  -- 1. 更新金币
  update profiles 
  set coins = coalesce(coins, 0) + p_coins
  where id = p_user_id;

  -- 2. 更新经验并升级
  if p_xp > 0 then
    current_exp := user_profile.current_exp + p_xp;
    current_level := user_profile.level;
    current_max_exp := user_profile.max_exp;
    
    while current_exp >= current_max_exp loop
      current_exp := current_exp - current_max_exp;
      current_level := current_level + 1;
    end loop;
    
    update profiles 
    set 
      current_exp = current_exp,
      level = current_level,
      updated_at = now()
    where id = p_user_id;
  end if;
end;
$$;
