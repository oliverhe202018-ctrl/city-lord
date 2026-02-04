-- Fix missing 'claimed_at' column in user_missions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_missions' AND column_name = 'claimed_at') THEN
        ALTER TABLE public.user_missions ADD COLUMN claimed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create 'user_achievements' table if not exists
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, achievement_id)
);

-- Create 'messages' table if not exists
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'system',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS is enabled and policies exist (basic ones)
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Add policies for user_achievements if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_achievements' AND policyname = 'Users can read own achievements') THEN
        CREATE POLICY "Users can read own achievements" ON public.user_achievements FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- Add policies for messages if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'messages' AND policyname = 'Users can read own messages') THEN
        CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT USING (auth.uid() = receiver_id);
    END IF;
END $$;
