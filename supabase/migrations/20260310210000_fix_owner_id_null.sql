-- Fix for territories table:
-- The owner_id column was originally defined as NOT NULL in Phase 1.
-- However, Phase 2A (decay_territories_daily) and Phase 2B-2B (purge_faction_territories)
-- both require setting owner_id to NULL to represent a neutral, unowned territory.
-- We must drop the NOT NULL constraint to allow this.

ALTER TABLE public.territories ALTER COLUMN owner_id DROP NOT NULL;
