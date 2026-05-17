-- IDEMPOTENCY KEYS
-- 用于存储幂等性 Key 的临时表 (替代 Redis)
create table if not exists idempotency_keys (
  id uuid primary key, -- UUID v4 from request header
  user_id uuid references auth.users(id) on delete cascade,
  status text not null check (status in ('PROCESSING', 'SUCCESS', 'FAILED')),
  response_body jsonb, -- 缓存成功响应结果
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  locked_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null -- 过期时间
);

-- 索引：加速查询和清理
create index if not exists idx_idempotency_keys_user_id on idempotency_keys(user_id);
create index if not exists idx_idempotency_keys_expires_at on idempotency_keys(expires_at);

-- RLS
alter table idempotency_keys enable row level security;
-- 仅允许 Service Role (后端) 操作此表，普通用户不可直接访问
create policy "Service role only" on idempotency_keys for all using (false);


-- RPC: 检查并锁定幂等性 Key
-- 返回: 
--   status: 'NEW' (新请求), 'PROCESSING' (处理中), 'SUCCESS' (已完成)
--   response: 如果是 SUCCESS，返回之前的响应
create or replace function check_idempotency_key(
  key_id uuid,
  current_user_id uuid,
  lock_seconds int default 300 -- 默认锁定 5 分钟
)
returns json
language plpgsql
security definer
as $$
declare
  existing_record idempotency_keys%ROWTYPE;
begin
  -- 1. 清理过期 Key (懒清理策略，也可以用定时任务)
  delete from idempotency_keys where expires_at < now();
  
  -- 2. 查询 Key
  select * into existing_record 
  from idempotency_keys 
  where id = key_id and user_id = current_user_id;
  
  -- 场景 A: Key 不存在 -> 视为新请求
  if existing_record is null then
    insert into idempotency_keys (id, user_id, status, locked_at, expires_at)
    values (
      key_id, 
      current_user_id, 
      'PROCESSING', 
      now(), 
      now() + (lock_seconds || ' seconds')::interval
    );
    return json_build_object('status', 'NEW');
  end if;
  
  -- 场景 B: Key 存在且为 SUCCESS -> 返回缓存结果
  if existing_record.status = 'SUCCESS' then
    return json_build_object(
      'status', 'SUCCESS',
      'response', existing_record.response_body
    );
  end if;
  
  -- 场景 C: Key 存在且为 PROCESSING -> 并发冲突
  if existing_record.status = 'PROCESSING' then
    -- 检查是否超时 (防止死锁)
    if existing_record.expires_at < now() then
       -- 已过期，重置为 PROCESSING
       update idempotency_keys 
       set status = 'PROCESSING', expires_at = now() + (lock_seconds || ' seconds')::interval
       where id = key_id;
       return json_build_object('status', 'NEW');
    end if;
    
    return json_build_object('status', 'PROCESSING');
  end if;
  
  -- 场景 D: Key 存在且为 FAILED -> 允许重试
  if existing_record.status = 'FAILED' then
    update idempotency_keys 
    set status = 'PROCESSING', expires_at = now() + (lock_seconds || ' seconds')::interval
    where id = key_id;
    return json_build_object('status', 'NEW');
  end if;
  
  return json_build_object('status', 'UNKNOWN');
end;
$$;


-- RPC: 完成幂等性请求
create or replace function complete_idempotency_key(
  key_id uuid,
  result_status text, -- 'SUCCESS' or 'FAILED'
  result_body jsonb default null
)
returns void
language plpgsql
security definer
as $$
begin
  if result_status = 'SUCCESS' then
    update idempotency_keys
    set status = 'SUCCESS', response_body = result_body
    where id = key_id;
  else
    -- 如果失败，可以选择删除 Key 允许立即重试，或者标记为 FAILED
    -- 这里选择删除，允许用户立即重试
    delete from idempotency_keys where id = key_id;
  end if;
end;
$$;
