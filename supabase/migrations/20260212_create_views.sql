-- ============================================================
-- SQL Views for City Lord Game (Supabase / PostgreSQL)
-- Generated based on prisma/schema.prisma
-- ============================================================

-- 1. Club Summary View (v_clubs_summary)
-- Provides club details with member counts and owner info.
-- Includes fields for both App (public) and Admin dashboard.

DROP VIEW IF EXISTS v_clubs_summary;

CREATE VIEW v_clubs_summary AS
SELECT
    c.id,
    c.name,
    c.description,
    c.owner_id,
    c.created_at,
    c.status,
    c.audit_reason,
    c.province,
    c.total_area,
    c.avatar_url,
    c.is_public,
    c.level,
    c.rating,
    c.territory,
    -- Aggregated Stats
    (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id AND cm.status = 'active') AS active_member_count,
    (SELECT COUNT(*) FROM club_members cm WHERE cm.club_id = c.id) AS total_member_count,
    -- Owner Info
    p.nickname AS owner_name,
    p.avatar_url AS owner_avatar
FROM
    clubs c
LEFT JOIN
    profiles p ON c.owner_id = p.id;

-- 2. Room Summary View (v_rooms_summary)
-- Provides room details with participant counts and host info.

DROP VIEW IF EXISTS v_rooms_summary;

CREATE VIEW v_rooms_summary AS
SELECT
    r.id,
    r.host_id,
    r.name,
    r.target_distance_km,
    r.target_duration_minutes,
    r.max_participants,
    r.is_private,
    r.status,
    r.created_at,
    r.is_banned,
    r.allow_chat,
    r.icon_url,
    r.description,
    r.allow_imports,
    r.avatar_url,
    r.category,
    r.invite_code,
    r.allow_member_invite,
    -- Aggregated Stats
    (SELECT COUNT(*) FROM room_participants rp WHERE rp.room_id = r.id AND rp.status = 'active') AS active_participant_count,
    (SELECT COUNT(*) FROM room_participants rp WHERE rp.room_id = r.id) AS total_participant_count,
    -- Host Info
    p.nickname AS host_name,
    p.avatar_url AS host_avatar
FROM
    rooms r
LEFT JOIN
    profiles p ON r.host_id = p.id;

-- 3. Faction Stats Materialized View (mv_faction_stats)
-- High-performance aggregated stats for Factions (Red vs Blue).
-- To be refreshed manually via Cron Job.

DROP MATERIALIZED VIEW IF EXISTS mv_faction_stats;

CREATE MATERIALIZED VIEW mv_faction_stats AS
SELECT
    p.faction,
    COUNT(p.id) AS total_members,
    COALESCE(SUM(p.total_area), 0) AS total_member_area, -- Sum of individual areas
    -- Alternative: Calculate territory area directly from territories table if needed for accuracy
    (
        SELECT COALESCE(SUM(CASE WHEN p2.faction = p.faction THEN 1 ELSE 0 END) * 0.00026, 0) -- Assuming ~260m2 per hex, converted to km2 or similar unit
        FROM territories t
        JOIN profiles p2 ON t.owner_id = p2.id
        WHERE p2.faction = p.faction
    ) AS total_territory_area_km2,
    NOW() as last_updated
FROM
    profiles p
WHERE
    p.faction IS NOT NULL
GROUP BY
    p.faction;

-- Create index for faster lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_faction_stats_faction ON mv_faction_stats(faction);

-- 4. RLS Policies (Security)
-- Views usually inherit permissions of underlying tables in standard SQL, 
-- but in Supabase/PostgREST, we often need to grant SELECT permissions to the role.

-- Grant access to authenticated users and service_role
GRANT SELECT ON v_clubs_summary TO authenticated, service_role;
GRANT SELECT ON v_rooms_summary TO authenticated, service_role;
GRANT SELECT ON mv_faction_stats TO authenticated, service_role;

-- Note: RLS on Views is tricky in Postgres < 15. 
-- In Supabase, it's often better to rely on RLS of the underlying tables 
-- OR use "security_invoker = true" when creating views if you want them to respect underlying RLS.
-- Let's apply security_invoker to standard views.

ALTER VIEW v_clubs_summary SET (security_invoker = true);
ALTER VIEW v_rooms_summary SET (security_invoker = true);

-- Materialized views do NOT support security_invoker. 
-- Access is controlled by GRANTs above, effectively bypassing RLS on underlying tables for this specific aggregate.
-- This is usually desired for global stats (public info).
