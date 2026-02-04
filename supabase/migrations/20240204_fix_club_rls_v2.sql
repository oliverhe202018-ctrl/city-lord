-- Enable RLS for clubs table
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- 1. Allow authenticated users to create clubs
-- Note: 'owner_id' is the column name, not 'created_by'
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.clubs;
CREATE POLICY "Enable insert for authenticated users only"
ON public.clubs
FOR INSERT
TO authenticated
WITH CHECK (true);
-- Alternatively, if you want to enforce that they can only create clubs where they are the owner:
-- WITH CHECK (auth.uid() = owner_id); 
-- But typically 'owner_id' might be set by the backend or trigger. 
-- If the client sends it, use: WITH CHECK (auth.uid() = owner_id);

-- 2. Allow everyone to view clubs
DROP POLICY IF EXISTS "Enable read access for all users" ON public.clubs;
CREATE POLICY "Enable read access for all users"
ON public.clubs
FOR SELECT
TO authenticated
USING (true);

-- 3. Allow club owner to update
DROP POLICY IF EXISTS "Enable update for club owners" ON public.clubs;
CREATE POLICY "Enable update for club owners"
ON public.clubs
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id);

-- Enable RLS for club_members table
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- 4. Allow users to join clubs (insert into club_members)
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.club_members;
CREATE POLICY "Enable insert for authenticated users"
ON public.club_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5. Allow members to view other members
DROP POLICY IF EXISTS "Enable read access for all users" ON public.club_members;
CREATE POLICY "Enable read access for all users"
ON public.club_members
FOR SELECT
TO authenticated
USING (true);

-- 6. Allow users to leave clubs (delete their own membership)
DROP POLICY IF EXISTS "Enable delete for own membership" ON public.club_members;
CREATE POLICY "Enable delete for own membership"
ON public.club_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
