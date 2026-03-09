-- Add missing 'type' column to messages table
-- This was mistakenly omitted from the previous voice-messaging migration

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
