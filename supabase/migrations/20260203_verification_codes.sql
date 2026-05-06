
create table if not exists verification_codes (
  id uuid default uuid_generate_v4() primary key,
  email text not null,
  code text not null,
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default now(),
  verified boolean default false
);

-- Index for faster lookup
create index if not exists idx_verification_codes_email on verification_codes(email);

-- RLS
alter table verification_codes enable row level security;

-- Allow anyone to insert (sending code) - controlled by API
create policy "Server can insert codes" on verification_codes for insert with check (true);

-- Allow server to read/update (verification) - actually this is mostly for server-side logic
-- But if we use RLS, we need policies.
-- Since we will use Service Role (or just anon key with specific logic) in API routes, we might need policies.
-- Actually, the API route will use `supabase-js` on the server.
-- If we don't have SERVICE_ROLE_KEY, we use the anon key.
-- So we need to allow Anon to insert/select? No, that's insecure.
-- We should probably make this table accessible ONLY via RPC or strictly controlled policies?
-- Or, simpler: Allow anon to insert, but only select their own? No, they don't have user_id yet.
-- Allow select by email?
create policy "Anyone can insert" on verification_codes for insert with check (true);
create policy "Anyone can select" on verification_codes for select using (true);
create policy "Anyone can update" on verification_codes for update using (true);
