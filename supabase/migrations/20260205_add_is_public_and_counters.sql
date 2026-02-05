-- 1. Ensure is_public column exists
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- 2. Create RPC for atomic increment of member count
CREATE OR REPLACE FUNCTION public.increment_club_member_count(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.clubs
  SET member_count = COALESCE(member_count, 0) + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create RPC for atomic decrement (for leaving)
CREATE OR REPLACE FUNCTION public.decrement_club_member_count(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.clubs
  SET member_count = GREATEST(COALESCE(member_count, 0) - 1, 0)
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
