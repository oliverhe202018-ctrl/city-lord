-- Enable RLS for clubs table
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to create a club (authenticated users)
CREATE POLICY "Enable insert for authenticated users only"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow members to view their clubs (or public clubs)
-- Assuming clubs are public or visible to members
CREATE POLICY "Enable read access for all users"
ON public.clubs
FOR SELECT
TO authenticated
USING (true);

-- Allow club owner to update
CREATE POLICY "Enable update for club owners"
ON public.clubs
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by);

-- Enable RLS for club_members table
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Allow users to join clubs (insert into club_members)
CREATE POLICY "Enable insert for authenticated users"
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Allow members to view other members
CREATE POLICY "Enable read access for all users"
ON public.club_members
FOR SELECT
TO authenticated
USING (true);

-- Allow users to leave clubs (delete their own membership)
CREATE POLICY "Enable delete for own membership"
ON public.club_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
