-- Create a function to refresh the materialized view
-- This function can be called via RPC from the Supabase client
create or replace function refresh_faction_stats()
returns void
language plpgsql
security definer -- Run with the privileges of the creator (usually postgres/service_role)
as $$
begin
  refresh materialized view concurrently mv_faction_stats;
end;
$$;
