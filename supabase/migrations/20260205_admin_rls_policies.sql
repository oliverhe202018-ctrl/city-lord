-- Create is_admin function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_admins
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update Clubs Table Policies

-- 1. Drop existing SELECT policy
DROP POLICY IF EXISTS "Clubs are viewable by everyone" ON public.clubs;

-- 2. Create new SELECT policies
-- Ordinary users can only see active clubs
CREATE POLICY "Public can view active clubs" 
ON public.clubs 
FOR SELECT 
USING (status = 'active');

-- Admins can see all clubs
CREATE POLICY "Admins can view all clubs" 
ON public.clubs 
FOR SELECT 
USING (is_admin());

-- 3. Create UPDATE policy for Admins
-- Admins can update any club (specifically intended for status and audit_reason, but RLS is row-level)
CREATE POLICY "Admins can update clubs" 
ON public.clubs 
FOR UPDATE 
USING (is_admin());

-- Update App Admins Table Policies

-- Ensure RLS is enabled
ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- We already have "Admins can view their own record" for SELECT from previous migration.
-- If not, ensure it exists:
DO $$ BEGIN
    CREATE POLICY "Admins can view their own record" 
    ON public.app_admins 
    FOR SELECT 
    USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Modification Policies for app_admins:
-- By default, with RLS enabled and no policies for INSERT/UPDATE/DELETE, 
-- only the Service Role (superuser) can modify the table.
-- This satisfies the requirement "Only super admins (via Service Role) can modify app_admins table".

-- Optional: If a specific user UUID needs to be hardcoded as super admin:
-- CREATE POLICY "Super admin can manage admins" 
-- ON public.app_admins 
-- FOR ALL 
-- USING (auth.uid() = 'your-super-admin-uuid-here');
