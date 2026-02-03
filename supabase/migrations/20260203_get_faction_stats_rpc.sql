
-- 6. 获取阵营统计信息 (聚合查询)
create or replace function get_faction_stats_rpc()
returns table (
  faction text,
  member_count bigint,
  total_area numeric
)
language sql
security definer
as $$
  select 
    faction,
    count(*) as member_count,
    coalesce(sum(total_area), 0) as total_area
  from profiles
  where faction is not null
  group by faction;
$$;
