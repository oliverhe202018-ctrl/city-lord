-- Create club_status enum type
DO $$ BEGIN
    CREATE TYPE public.club_status AS ENUM ('pending', 'active', 'rejected', 'suspended');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Modify clubs table
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS status public.club_status DEFAULT 'pending';
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS audit_reason TEXT;

-- Backfill existing data to 'active' to ensure they don't disappear from view
-- (Assuming future logic will filter by status)
UPDATE public.clubs SET status = 'active';

-- Create app_admins table
CREATE TABLE IF NOT EXISTS public.app_admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'moderator',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for app_admins
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- Create policy for app_admins (allow users to read their own admin status)
DO $$ BEGIN
    CREATE POLICY "Admins can view their own record" 
    ON public.app_admins 
    FOR SELECT 
    USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
