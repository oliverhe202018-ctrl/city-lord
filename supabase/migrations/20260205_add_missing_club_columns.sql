-- Add missing columns to clubs table that are expected by the application logic
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS level TEXT DEFAULT '1',
ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS territory TEXT DEFAULT '0';
