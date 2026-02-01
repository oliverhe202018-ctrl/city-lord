
-- Clubs Table
CREATE TABLE IF NOT EXISTS public.clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    avatar_url TEXT,
    city_id TEXT, -- Optional linkage to a city
    level INTEGER DEFAULT 1,
    rating NUMERIC DEFAULT 5.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Club Members Table
CREATE TABLE IF NOT EXISTS public.club_members (
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    status TEXT CHECK (status IN ('pending', 'active', 'rejected')) DEFAULT 'pending',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (club_id, user_id)
);

-- Enable RLS
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

-- Club Policies
CREATE POLICY "Clubs are viewable by everyone" 
ON public.clubs FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create clubs" 
ON public.clubs FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their clubs" 
ON public.clubs FOR UPDATE 
USING (auth.uid() = owner_id);

-- Club Members Policies
CREATE POLICY "Club members are viewable by everyone" 
ON public.club_members FOR SELECT 
USING (true);

CREATE POLICY "Users can join clubs (create pending membership)" 
ON public.club_members FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Club admins/owners can update member status" 
ON public.club_members FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.club_members admins 
    WHERE admins.club_id = club_members.club_id 
    AND admins.user_id = auth.uid() 
    AND admins.role IN ('owner', 'admin')
  )
);
