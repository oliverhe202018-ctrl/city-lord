-- Migration: add club_channels and club_messages tables
-- Run this against your Supabase/PostgreSQL database

CREATE TABLE IF NOT EXISTS public.club_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(club_id, key)
);

CREATE INDEX IF NOT EXISTS idx_club_channels_club_id ON public.club_channels(club_id);

CREATE TABLE IF NOT EXISTS public.club_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.club_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_club_messages_channel_time ON public.club_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_messages_club_time ON public.club_messages(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_messages_sender ON public.club_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_club_messages_channel_active ON public.club_messages(channel_id, deleted_at, created_at DESC);
