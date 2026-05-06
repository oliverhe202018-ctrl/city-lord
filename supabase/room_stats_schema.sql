-- 扩展 room_participants 表，添加游戏统计字段
alter table room_participants
add column if not exists total_score int default 0,
add column if not exists territory_area numeric(10, 2) default 0.00,
add column if not exists territory_ratio numeric(5, 2) default 0.00,
add column if not exists stolen_lands int default 0,
add column if not exists lost_lands int default 0,
add column if not exists rivals_defeated int default 0,
add column if not exists growth_rate numeric(5, 2) default 0.00,
add column if not exists status text default 'active' check (status in ('active', 'offline', 'running'));

-- 创建索引以加速排序查询
create index if not exists idx_room_participants_score on room_participants(room_id, total_score desc);
create index if not exists idx_room_participants_ratio on room_participants(room_id, territory_ratio desc);

-- 创建一个函数来随机更新统计数据 (仅用于测试/开发环境演示)
create or replace function simulate_game_stats(target_room_id uuid)
returns void as $$
begin
  update room_participants
  set 
    total_score = floor(random() * 10000)::int,
    territory_area = (random() * 10)::numeric(10,2),
    territory_ratio = floor(random() * 20)::numeric(5,2),
    stolen_lands = floor(random() * 50)::int,
    lost_lands = floor(random() * 30)::int,
    rivals_defeated = floor(random() * 10)::int,
    growth_rate = (floor(random() * 100) - 20)::numeric(5,2),
    status = case when random() > 0.5 then 'running' else 'active' end
  where room_id = target_room_id;
end;
$$ language plpgsql;
