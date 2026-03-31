-- Phase 2B-1 Baseline Population Script
-- INSTRUCTIONS: Run this script MANUALLY in the Supabase SQL Editor exactly ONCE 
-- immediately after applying the infrastructure migration and BEFORE starting the Vercel Cron.

DO $$
DECLARE
    max_event_id BIGINT;
BEGIN
    -- 1. Grab the current maximum event ID to use as the starting cursor
    SELECT COALESCE(MAX(id), 0) INTO max_event_id FROM public.territory_events;

    -- 2. Clear existing stats just in case this is a re-run
    TRUNCATE TABLE public.club_territory_stats;
    TRUNCATE TABLE public.faction_territory_stats;
    TRUNCATE TABLE public.worker_cursors;

    -- 3. Populate club_territory_stats based on the territories table snapshot
    INSERT INTO public.club_territory_stats (club_id, total_area, total_tiles, last_synced_event_id, updated_at)
    SELECT 
        owner_club_id,
        COALESCE(SUM(area_m2_exact), 0) / 1000000.0 AS total_area,
        COUNT(*) AS total_tiles,
        max_event_id,
        NOW()
    FROM public.territories
    WHERE owner_club_id IS NOT NULL
    GROUP BY owner_club_id;

    -- 4. Populate faction_territory_stats based on the territories table snapshot
    INSERT INTO public.faction_territory_stats (faction_name, total_area, total_tiles, last_synced_event_id, updated_at)
    SELECT 
        owner_faction,
        COALESCE(SUM(area_m2_exact), 0) / 1000000.0 AS total_area,
        COUNT(*) AS total_tiles,
        max_event_id,
        NOW()
    FROM public.territories
    WHERE owner_faction IS NOT NULL
    GROUP BY owner_faction;

    -- 5. Set the worker cursor to the captured maximum event ID
    INSERT INTO public.worker_cursors (consumer_name, last_event_id, updated_at)
    VALUES ('stats_aggregator', max_event_id, NOW());

    RAISE NOTICE 'Baseline population completed successfully. Cursor anchored at Event ID: %', max_event_id;
END $$;
