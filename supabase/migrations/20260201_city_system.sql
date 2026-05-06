-- User City Progress Table
create table if not exists user_city_progress (
  user_id uuid references profiles(id) on delete cascade,
  city_id text not null, -- using text id like 'beijing' from config
  level int default 1,
  experience int default 0,
  tiles_captured int default 0,
  area_controlled numeric default 0,
  reputation int default 0,
  last_active_at timestamp with time zone default timezone('utc'::text, now()),
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (user_id, city_id)
);

-- RLS
alter table user_city_progress enable row level security;
create policy "Users can view their own progress" on user_city_progress for select using (auth.uid() = user_id);
create policy "Users can update their own progress" on user_city_progress for update using (auth.uid() = user_id);
create policy "Anyone can view leaderboard data" on user_city_progress for select using (true); -- needed for leaderboard

-- Achievements Progress (if we want to track per city or global)
create table if not exists user_achievements (
  user_id uuid references profiles(id) on delete cascade,
  achievement_id text not null,
  city_id text, -- optional, if achievement is city-specific
  progress int default 0,
  is_completed boolean default false,
  completed_at timestamp with time zone,
  primary key (user_id, achievement_id, city_id)
);

alter table user_achievements enable row level security;
create policy "Users can view own achievements" on user_achievements for select using (auth.uid() = user_id);
create policy "Users can update own achievements" on user_achievements for update using (auth.uid() = user_id);
