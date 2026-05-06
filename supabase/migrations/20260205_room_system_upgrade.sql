-- 1. Modify rooms table
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS allow_chat BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_imports BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Modify room_participants (acting as room_memberships)
ALTER TABLE public.room_participants
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member' CHECK (role IN ('host', 'admin', 'member'));

-- 3. Function to generate unique 6-digit code
CREATE OR REPLACE FUNCTION public.generate_unique_room_code()
RETURNS TRIGGER AS $$
DECLARE
  new_code TEXT;
  done BOOLEAN DEFAULT FALSE;
BEGIN
  -- Only generate if not provided
  IF NEW.invite_code IS NOT NULL THEN
    RETURN NEW;
  END IF;

  WHILE NOT done LOOP
    -- Generate 6 digit random number (100000 to 999999)
    new_code := floor(random() * (999999 - 100000 + 1) + 100000)::text;
    
    -- Check uniqueness
    PERFORM 1 FROM public.rooms WHERE invite_code = new_code;
    IF NOT FOUND THEN
      done := TRUE;
    END IF;
  END LOOP;

  NEW.invite_code := new_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger
DROP TRIGGER IF EXISTS trigger_generate_room_code ON public.rooms;
CREATE TRIGGER trigger_generate_room_code
BEFORE INSERT ON public.rooms
FOR EACH ROW
EXECUTE FUNCTION public.generate_unique_room_code();

-- 5. Create policy to allow joining via code (if needed)
-- We need to ensure users can select rooms by code even if they are not members yet
CREATE POLICY "Anyone can find room by code" 
ON public.rooms 
FOR SELECT 
USING (true); 
-- Existing "Anyone can read active rooms" might already cover this if status is active/waiting.
-- But let's ensure specific lookup by code is allowed.
