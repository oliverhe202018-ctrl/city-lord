-- 1. Add allow_member_invite column
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS allow_member_invite BOOLEAN DEFAULT true;

-- 2. Update max_participants default to 10 (optional, but aligns with requirement)
ALTER TABLE rooms 
ALTER COLUMN max_participants SET DEFAULT 10;

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
