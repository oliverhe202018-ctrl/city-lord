-- 1. Grant Schema Usage (Critical for "permission denied for schema public")
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Grant Table Access (Basic CRUD permissions)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 3. Fix Profiles RLS (Critical for 403 on profiles)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- 4. Fix Clubs RLS (Likely cause of 500 on /api/club/info if it queries clubs)
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clubs are viewable by everyone" ON clubs;
CREATE POLICY "Clubs are viewable by everyone" 
ON clubs FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Authenticated users can create clubs" ON clubs;
CREATE POLICY "Authenticated users can create clubs" 
ON clubs FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Club owners can update their club" ON clubs;
CREATE POLICY "Club owners can update their club" 
ON clubs FOR UPDATE 
USING (auth.uid() = owner_id);

-- 5. Fix Club Members RLS
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Club members are viewable by everyone" ON club_members;
CREATE POLICY "Club members are viewable by everyone" 
ON club_members FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can join clubs" ON club_members;
CREATE POLICY "Users can join clubs" 
ON club_members FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave clubs" ON club_members;
CREATE POLICY "Users can leave clubs" 
ON club_members FOR DELETE 
USING (auth.uid() = user_id);

