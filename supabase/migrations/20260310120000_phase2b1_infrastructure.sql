-- Migration for Phase 2B-1 Infrastructure (Territory Stats and Governance)

-- 1. Extend territory_events.event_type Check Constraint
-- Drop the existing constraint
ALTER TABLE public.territory_events
  DROP CONSTRAINT IF EXISTS check_valid_event_type;

-- Add the expanded constraint
ALTER TABLE public.territory_events
  ADD CONSTRAINT check_valid_event_type
  CHECK (event_type IN (
    'CLAIM', 
    'DETACH_CLUB', 
    'FACTION_BETRAYAL', 
    'DECAY_DAMAGE', 
    'DECAY_NEUTRALIZE', 
    'RECONCILE_ADJUST'
  ));

-- 2. Create Async Aggregation Tables
CREATE TABLE IF NOT EXISTS public.club_territory_stats (
    club_id UUID PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
    total_area NUMERIC NOT NULL DEFAULT 0,
    total_tiles INTEGER NOT NULL DEFAULT 0,
    last_synced_event_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.faction_territory_stats (
    faction_name TEXT PRIMARY KEY,
    total_area NUMERIC NOT NULL DEFAULT 0,
    total_tiles INTEGER NOT NULL DEFAULT 0,
    last_synced_event_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Multi-Consumer Cursors Table
CREATE TABLE IF NOT EXISTS public.worker_cursors (
    consumer_name TEXT PRIMARY KEY,
    last_event_id BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
