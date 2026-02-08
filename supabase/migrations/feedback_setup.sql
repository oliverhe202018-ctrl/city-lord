-- 1. Create feedback table
create table public.feedback (
  id uuid not null default gen_random_uuid (),
  user_id uuid null,
  content text not null,
  contact_info text not null,
  screenshot_url text null,
  status text null default 'pending'::text,
  created_at timestamp with time zone null default now(),
  constraint feedback_pkey primary key (id),
  constraint feedback_user_id_fkey foreign key (user_id) references auth.users (id)
);

-- 2. Enable RLS
alter table public.feedback enable row level security;

-- 3. Create RLS Policies
-- Allow authenticated users to insert (submit feedback)
create policy "Enable insert for authenticated users only" 
on public.feedback 
for insert 
to authenticated 
with check (true);

-- Allow anonymous users to insert (optional, if you want unauthenticated feedback)
-- create policy "Enable insert for anon users" on public.feedback for insert to anon with check (true);

-- Allow service role (and admins) to do everything
-- Note: Service role bypasses RLS, but if you have admin users defined in public.users, you might need a policy for them.
-- Assuming admins are managed via app logic or service role.
-- For now, we'll ensure users can only see their own feedback if we were to list it, 
-- but for now the requirement says Admin SELECT/UPDATE.

-- Allow admins to select/update (Implementation depends on how you identify admins. 
-- Often checking a claim or a separate profiles table. 
-- For simplicity here, we assume the admin panel uses the Service Role or a specific admin policy.)

-- Simple policy for users to see their own feedback (optional)
create policy "Users can see their own feedback" 
on public.feedback 
for select 
to authenticated 
using (auth.uid() = user_id);

-- 4. Create Storage Bucket
-- Note: Buckets are usually created via the Storage API or UI, but can be done via SQL in some setups if the extension is enabled.
-- Here is the SQL to insert into storage.buckets if using Supabase Storage schema.

insert into storage.buckets (id, name, public)
values ('feedback-images', 'feedback-images', true)
on conflict (id) do nothing;

-- 5. Storage Policies
-- Allow authenticated users to upload to feedback-images
create policy "Allow authenticated uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feedback-images'
);

-- Allow public read access to feedback-images (so admins can see them)
create policy "Allow public read access"
on storage.objects
for select
to public
using (bucket_id = 'feedback-images');
