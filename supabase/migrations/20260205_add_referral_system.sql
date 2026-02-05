-- 1. Add columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES profiles(id);

-- 2. Create function to generate unique referral code
CREATE OR REPLACE FUNCTION generate_unique_referral_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code text;
    done bool;
BEGIN
    done := false;
    WHILE NOT done LOOP
        -- Generate 6-character random string (Upper case letters and numbers)
        -- Using substring of md5 hash is one way, but for readable codes:
        -- We can use a custom logic or simply random characters.
        -- Here is a simple approach using array of chars.
        
        new_code := upper(substring(md5(random()::text) from 1 for 6));
        
        -- Check uniqueness
        IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = new_code) THEN
            done := true;
        END IF;
    END LOOP;
    
    NEW.referral_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger
DROP TRIGGER IF EXISTS trigger_set_referral_code ON profiles;
CREATE TRIGGER trigger_set_referral_code
BEFORE INSERT ON profiles
FOR EACH ROW
WHEN (NEW.referral_code IS NULL)
EXECUTE FUNCTION generate_unique_referral_code();

-- 4. Backfill for existing users (One-time execution block)
DO $$
DECLARE
    r RECORD;
    new_code text;
    done bool;
BEGIN
    FOR r IN SELECT id FROM profiles WHERE referral_code IS NULL LOOP
        done := false;
        WHILE NOT done LOOP
            new_code := upper(substring(md5(random()::text) from 1 for 6));
            IF NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = new_code) THEN
                done := true;
            END IF;
        END LOOP;
        
        UPDATE profiles SET referral_code = new_code WHERE id = r.id;
    END LOOP;
END $$;
