-- Add avatar_url and is_public to clubs table
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
