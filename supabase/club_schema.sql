-- CLUBS
create table if not exists clubs (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references profiles(id),
  name text not null,
  description text,
  avatar_url text,
  level text default '初级',
  rating numeric default 5.0,
  member_count int default 1,
  territory text default '0 km²',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- CLUB MEMBERS
create table if not exists club_members (
  club_id uuid references clubs(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  status text default 'pending' check (status in ('pending', 'active')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (club_id, user_id)
);

-- RLS
alter table clubs enable row level security;
alter table club_members enable row level security;

create policy "Anyone can view clubs" on clubs for select using (true);
create policy "Owners can update clubs" on clubs for update using (auth.uid() = owner_id);

create policy "Members can view members" on club_members for select using (true);
create policy "Users can apply" on club_members for insert with check (auth.uid() = user_id);
create policy "Owners can update members" on club_members for update using (
  exists (select 1 from clubs where id = club_members.club_id and owner_id = auth.uid())
);
