/*
 * ⚠️ DEPRECATED — 2026-05-10
 * 
 * 这些 RPC 函数引用了已废弃的 current_exp / max_exp 字段。
 * 当前 profiles 表使用 xp 字段存储经验，升级逻辑已统一迁移至：
 *   lib/game-logic/experience-service.ts (addExperienceUnified)
 *   lib/game-logic/level-system.ts (LEVEL_THRESHOLDS)
 * 
 * 如需迁移数据库中的旧函数，请执行：
 *   DROP FUNCTION IF EXISTS add_user_experience(int) CASCADE;
 *   DROP FUNCTION IF EXISTS increment_user_stats(uuid, int, int) CASCADE;
 * 
 * 本文件保留为历史参考，严禁在生产环境执行。
 */

-- 1. 增加经验值 (原子操作) [DEPRECATED]
-- create or replace function add_user_experience(amount int)
-- returns json
-- language plpgsql
-- security definer
-- as $$
-- declare
--   current_user_id uuid;
--   new_exp int;
--   new_level int;
--   current_max_exp int;
--   user_profile profiles%ROWTYPE;
-- begin
--   current_user_id := auth.uid();
--   
--   select * into user_profile from profiles where id = current_user_id for update;
--   
--   new_exp := user_profile.current_exp + amount;
--   new_level := user_profile.level;
--   current_max_exp := user_profile.max_exp;
--   
--   while new_exp >= current_max_exp loop
--     new_exp := new_exp - current_max_exp;
--     new_level := new_level + 1;
--   end loop;
--   
--   update profiles
--   set 
--     current_exp = new_exp,
--     level = new_level,
--     updated_at = now()
--   where id = current_user_id;
--   
--   return json_build_object(
--     'level', new_level,
--     'current_exp', new_exp,
--     'max_exp', current_max_exp,
--     'leveled_up', new_level > user_profile.level
--   );
-- end;
-- $$;

-- 2. 消耗体力 (原子操作) [保留 — 仍可使用]
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

-- 3. 恢复体力 (原子操作) [保留 — 仍可使用]
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

-- 4. 增加领地面积 (原子操作) [保留 — 仍可使用]
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

-- 5. 增加用户属性 (原子操作 - 通用) [DEPRECATED]
-- create or replace function increment_user_stats(
--   p_user_id uuid,
--   p_xp int,
--   p_coins int
-- )
-- returns void
-- language plpgsql
-- security definer
-- as $$
-- declare
--   current_exp int;
--   current_level int;
--   current_max_exp int;
--   user_profile profiles%ROWTYPE;
-- begin
--   select * into user_profile from profiles where id = p_user_id for update;
--   
--   if not found then
--     return;
--   end if;
--
--   update profiles 
--   set coins = coalesce(coins, 0) + p_coins
--   where id = p_user_id;
--
--   if p_xp > 0 then
--     current_exp := user_profile.current_exp + p_xp;
--     current_level := user_profile.level;
--     current_max_exp := user_profile.max_exp;
--     
--     while current_exp >= current_max_exp loop
--       current_exp := current_exp - current_max_exp;
--       current_level := current_level + 1;
--     end loop;
--     
--     update profiles 
--     set 
--       current_exp = current_exp,
--       level = current_level,
--       updated_at = now()
--     where id = p_user_id;
--   end if;
-- end;
-- $$;
