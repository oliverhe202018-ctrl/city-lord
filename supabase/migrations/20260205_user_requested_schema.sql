-- 1. Modify clubs table (增加省份和总面积字段)
ALTER TABLE public.clubs 
ADD COLUMN IF NOT EXISTS province TEXT,
ADD COLUMN IF NOT EXISTS total_area NUMERIC DEFAULT 0;

-- 2. Modify profiles table (增加省份字段)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS province TEXT;

-- 3. Create runs table (创建跑步记录表)
CREATE TABLE IF NOT EXISTS public.runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
    area NUMERIC NOT NULL DEFAULT 0,
    duration INTEGER NOT NULL DEFAULT 0, -- Duration in seconds
    province TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for runs
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Policies for runs
CREATE POLICY "Users can view all runs" 
ON public.runs FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own runs" 
ON public.runs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own runs" 
ON public.runs FOR UPDATE 
USING (auth.uid() = user_id);
