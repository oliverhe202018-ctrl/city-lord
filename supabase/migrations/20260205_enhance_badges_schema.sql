-- Add missing columns to badges table to support sync
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS icon_path TEXT;
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS requirement_type TEXT; -- 'distance' | 'area' | 'count'
ALTER TABLE public.badges ADD COLUMN IF NOT EXISTS requirement_value NUMERIC; -- To match user request, though condition_value exists

-- Update badges table to ensure code is unique constraint for upsert
ALTER TABLE public.badges DROP CONSTRAINT IF EXISTS badges_code_key;
ALTER TABLE public.badges ADD CONSTRAINT badges_code_key UNIQUE (code);
