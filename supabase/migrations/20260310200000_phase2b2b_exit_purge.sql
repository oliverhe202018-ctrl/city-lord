-- Migration for Phase 2B-2B: Club Exit Detachment & Faction Change Purge

-- 0. Update constraints for territory_events to allow new event types
ALTER TABLE public.territory_events DROP CONSTRAINT IF EXISTS check_valid_event_type;
ALTER TABLE public.territory_events ADD CONSTRAINT check_valid_event_type CHECK (
    event_type IN ('CLAIM', 'DETACH_CLUB', 'FACTION_BETRAYAL', 'ABANDON', 'CLUB_DISBAND', 'SYSTEM_RESET', 'DECAY_DAMAGE', 'DECAY_NEUTRALIZE', 'RECONCILE_ADJUST')
);
-- 1. RPC for Club Exit Detachment
-- When a user leaves/is kicked from a club, their territories detach from the club but remain owned by them.
CREATE OR REPLACE FUNCTION public.detach_club_territories(p_user_id UUID, p_club_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action_id VARCHAR(100);
BEGIN
    v_action_id := 'club_exit_' || p_club_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT;

    -- Step 1: Insert DETACH_CLUB events for all territories matching user and club
    INSERT INTO public.territory_events (
        territory_id,
        event_type,
        user_id,
        old_owner_id,
        new_owner_id,
        old_club_id,
        new_club_id,
        old_faction,
        new_faction,
        action_id,
        processed_for_stats,
        created_at
    )
    SELECT
        id,
        'DETACH_CLUB',
        p_user_id,
        owner_id,
        owner_id,
        owner_club_id,
        NULL,
        owner_faction,
        owner_faction,
        v_action_id,
        FALSE,
        NOW()
    FROM public.territories
    WHERE owner_id = p_user_id AND owner_club_id = p_club_id;

    -- Step 2: Update the territories to detach them from the club
    UPDATE public.territories
    SET owner_club_id = NULL
    WHERE owner_id = p_user_id AND owner_club_id = p_club_id;
END;
$$;


-- 2. RPC for Faction Change Purge
-- When a user changes faction, their territories are completely neutralized.
CREATE OR REPLACE FUNCTION public.purge_faction_territories(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_action_id VARCHAR(100);
BEGIN
    v_action_id := 'faction_purge_' || p_user_id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT;

    -- Step 1: Insert FACTION_BETRAYAL events for all territories owned by the user
    INSERT INTO public.territory_events (
        territory_id,
        event_type,
        user_id,
        old_owner_id,
        new_owner_id,
        old_club_id,
        new_club_id,
        old_faction,
        new_faction,
        action_id,
        processed_for_stats,
        created_at
    )
    SELECT
        id,
        'FACTION_BETRAYAL',
        p_user_id,
        owner_id,
        NULL,
        owner_club_id,
        NULL,
        owner_faction,
        NULL,
        v_action_id,
        FALSE,
        NOW()
    FROM public.territories
    WHERE owner_id = p_user_id;

    -- Step 2: Neutralize the territories completely
    UPDATE public.territories
    SET 
        owner_id = NULL,
        owner_club_id = NULL,
        owner_faction = NULL,
        health = 0
    WHERE owner_id = p_user_id;
END;
$$;
