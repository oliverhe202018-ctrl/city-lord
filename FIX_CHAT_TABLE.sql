-- Create room_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;

-- Policies
-- Allow all authenticated users to insert messages
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON public.room_messages;
CREATE POLICY "Authenticated users can insert messages"
ON public.room_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow all authenticated users to view messages
DROP POLICY IF EXISTS "Authenticated users can select messages" ON public.room_messages;
CREATE POLICY "Authenticated users can select messages"
ON public.room_messages
FOR SELECT
TO authenticated
USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON public.room_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_room_messages_created_at ON public.room_messages(created_at);
