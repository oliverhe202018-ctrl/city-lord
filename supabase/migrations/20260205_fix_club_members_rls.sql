-- Ensure club_members table exists
CREATE TABLE IF NOT EXISTS public.club_members (
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    status TEXT CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (club_id, user_id)
);

-- Enable RLS
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Club members are viewable by everyone" ON public.club_members;
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
DROP POLICY IF EXISTS "Users can leave clubs" ON public.club_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.club_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.club_members;
DROP POLICY IF EXISTS "Enable delete for own membership" ON public.club_members;
DROP POLICY IF EXISTS "Users can apply" ON public.club_members;
DROP POLICY IF EXISTS "Members can view members" ON public.club_members;
DROP POLICY IF EXISTS "Allow authenticated users to view club members" ON public.club_members;
DROP POLICY IF EXISTS "Allow authenticated users to join clubs" ON public.club_members;
DROP POLICY IF EXISTS "Allow users to leave clubs" ON public.club_members;


-- 1. SELECT: Allow all authenticated users to read club_members
-- This allows checking membership status and viewing members
CREATE POLICY "Allow authenticated users to view club members"
ON public.club_members
FOR SELECT
TO authenticated
USING (true);

-- 2. INSERT: Allow authenticated users to add themselves
CREATE POLICY "Allow authenticated users to join clubs"
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 3. DELETE: Allow users to delete their own record (leave club)
CREATE POLICY "Allow users to leave clubs"
ON public.club_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
