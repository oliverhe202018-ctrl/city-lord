-- 1. Create storage bucket for voice messages
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-messages', 'voice-messages', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow authenticated users to upload to voice-messages
CREATE POLICY "Allow authenticated uploads to voice_messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'voice-messages' );

-- 3. Allow public reading
CREATE POLICY "Allow public viewing of voice_messages"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'voice-messages' );

-- 4. Add columns to messages table
ALTER TABLE public.messages
-- 'type' is already present in 'messages' table per codebase analysis, but Prisma didn't have it tracked explicitly or we just added it. Wait, the 'type' column is already in Supabase! I need to ensure it's not complaining. Let's just add the other fields.
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS waveform JSONB,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS size_bytes INTEGER;

-- 5. Add columns to room_messages table
ALTER TABLE public.room_messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS waveform JSONB,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS size_bytes INTEGER;

-- 6. Add columns to club_messages table
ALTER TABLE public.club_messages
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS waveform JSONB,
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
