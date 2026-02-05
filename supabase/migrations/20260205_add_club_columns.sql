-- Add province and is_public columns to clubs table
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Update RLS if needed (e.g. if we want to restrict visibility based on is_public)
-- For now, existing policies allow view all, which is fine for discovery, 
-- but we might want to filter is_public=false in public lists later.
