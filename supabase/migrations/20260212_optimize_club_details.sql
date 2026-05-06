-- Create a view for efficient club summary retrieval
-- This abstracts the underlying table structure and allows for easier future optimization (e.g. switching to materialized view)
DROP VIEW IF EXISTS v_clubs_summary;

CREATE OR REPLACE VIEW v_clubs_summary AS
SELECT 
    c.id as club_id,
    c.name,
    c.description,
    c.avatar_url,
    c.province,
    c.created_at,
    c.owner_id,
    c.status,
    c.level,
    c.rating,
    -- Use the stored counts/area for performance. 
    -- If these are not maintained by triggers, we would need to aggregate here, but that would be slow for a standard view.
    COALESCE(c.member_count, 0) as member_count,
    COALESCE(c.total_area, 0) as total_area,
    COALESCE(c.territory, '0') as territory_desc
FROM clubs c;
-- Removed WHERE c.status = 'active' to ensure all clubs are visible regardless of status (application layer handles filtering)

-- Grant access to authenticated users
GRANT SELECT ON v_clubs_summary TO authenticated;
GRANT SELECT ON v_clubs_summary TO service_role;
