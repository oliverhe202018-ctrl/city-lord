-- Create territories table
CREATE TABLE IF NOT EXISTS public.territories (
    id TEXT PRIMARY KEY, -- H3 index
    city_id TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    captured_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Optional: add color or level if needed later
    -- For now, we derive color from the owner's profile or city theme? 
    -- Actually, usually territories show the user's color or just "owned".
    
    CONSTRAINT territories_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Territories are viewable by everyone" 
ON public.territories FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own territories" 
ON public.territories FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own territories" 
ON public.territories FOR UPDATE 
USING (auth.uid() = owner_id);

-- Create index for faster querying by city
CREATE INDEX IF NOT EXISTS idx_territories_city_id ON public.territories(city_id);
CREATE INDEX IF NOT EXISTS idx_territories_owner_id ON public.territories(owner_id);
