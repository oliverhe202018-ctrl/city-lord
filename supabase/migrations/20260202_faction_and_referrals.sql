-- Migration: Add Faction and Referral support to profiles
-- Date: 2026-02-02

-- 1. Add columns to profiles table
DO $$
BEGIN
    -- Add faction column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'faction') THEN
        ALTER TABLE public.profiles ADD COLUMN faction TEXT CHECK (faction IN ('RED', 'BLUE'));
    END IF;

    -- Add last_faction_change_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_faction_change_at') THEN
        ALTER TABLE public.profiles ADD COLUMN last_faction_change_at TIMESTAMPTZ;
    END IF;

    -- Add invited_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'invited_by') THEN
        ALTER TABLE public.profiles ADD COLUMN invited_by UUID REFERENCES public.profiles(id);
    END IF;

    -- Add coins column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'coins') THEN
        ALTER TABLE public.profiles ADD COLUMN coins INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_profiles_faction ON public.profiles(faction);
CREATE INDEX IF NOT EXISTS idx_profiles_invited_by ON public.profiles(invited_by);

-- 3. RPC for processing referrals (Atomic Transaction)
CREATE OR REPLACE FUNCTION public.process_referral(new_user_id UUID, referrer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as database owner (bypass RLS for updating referrer's coins)
AS $$
DECLARE
    referrer_exists BOOLEAN;
    already_invited BOOLEAN;
BEGIN
    -- 1. Validate Referrer exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE id = referrer_id) INTO referrer_exists;
    IF NOT referrer_exists THEN
        RETURN jsonb_build_object('success', false, 'error', 'Referrer not found');
    END IF;

    -- 2. Validate New User hasn't been invited yet
    SELECT (invited_by IS NOT NULL) INTO already_invited FROM public.profiles WHERE id = new_user_id;
    IF already_invited THEN
        RETURN jsonb_build_object('success', false, 'error', 'User already referred');
    END IF;

    -- 3. Prevent self-referral
    IF new_user_id = referrer_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot refer yourself');
    END IF;

    -- 4. Update New User (Set invited_by)
    UPDATE public.profiles
    SET invited_by = referrer_id
    WHERE id = new_user_id;

    -- 5. Reward Referrer (Add 100 coins)
    UPDATE public.profiles
    SET coins = COALESCE(coins, 0) + 100
    WHERE id = referrer_id;

    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
