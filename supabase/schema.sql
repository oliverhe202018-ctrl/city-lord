
-- ROOMS
create table if not exists rooms (
  id uuid default uuid_generate_v4() primary key,
  host_id uuid references profiles(id) on delete cascade,
  name text not null,
  target_distance_km numeric,
  target_duration_minutes integer,
  max_participants integer default 10,
  is_private boolean default false,
  password text,
  status text default 'waiting' check (status in ('waiting', 'active', 'ended')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ROOM PARTICIPANTS
create table if not exists room_participants (
  room_id uuid references rooms(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (room_id, user_id)
);

-- RLS for Rooms
alter table rooms enable row level security;

create policy "Anyone can read active rooms" on rooms for select
  using (status = 'waiting' or status = 'active');

create policy "Users can create rooms" on rooms for insert
  with check (auth.role() = 'authenticated');

create policy "Host can update room" on rooms for update
  using (auth.uid() = host_id);

create policy "Host can delete room" on rooms for delete
  using (auth.uid() = host_id);

-- RLS for Room Participants
alter table room_participants enable row level security;

create policy "Anyone can read participants" on room_participants for select
  using (true);

create policy "Users can join rooms" on room_participants for insert
  with check (auth.uid() = user_id);

create policy "Users can leave rooms" on room_participants for delete
  using (auth.uid() = user_id);
