-- 1. Create suspicious_location_report table for anti-cheat logging
CREATE TABLE IF NOT EXISTS public.suspicious_location_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('map_teleport', 'run_session_teleport')),
    location JSONB NOT NULL, -- Format: { "lat": number, "lng": number }
    reported_speed FLOAT NOT NULL, -- Calculated speed in km/h that triggered the alert
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS on suspicious_location_report
ALTER TABLE public.suspicious_location_report ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for suspicious_location_report
-- Authenticated users can only READ their own reports. 
-- Inserts will be done exclusively on the server side using the service_role key to bypass RLS.
CREATE POLICY "Users can read own suspicious reports" 
    ON public.suspicious_location_report 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Explicitly block standard client inserts/updates
CREATE POLICY "Block client insert on suspicious report"
    ON public.suspicious_location_report
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Block client update on suspicious report"
    ON public.suspicious_location_report
    FOR UPDATE
    USING (false);

-- 4. Harden user_locations table RLS
-- user_locations was created in a previous migration, ensure RLS is enabled
ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Users can read their own location (if needed by client)
CREATE POLICY "Users can read own location" 
    ON public.user_locations 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Explicitly block standard client inserts/updates on user_locations
-- Write operations MUST go through our API routes using service_role to enforce the 300km/h speed check
CREATE POLICY "Block client insert on user_locations"
    ON public.user_locations
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY "Block client update on user_locations"
    ON public.user_locations
    FOR UPDATE
    USING (false);

-- 5. Create RPC for updating user_locations securely
-- Because Prisma cannot execute ST_SetSRID directly without raw SQL, and we are moving away from Prisma for this,
-- we use a Supabase RPC function.
-- SECURITY DEFINER is required so that even if an authenticated user manages to call this directly,
-- the internal RLS block on INSERT/UPDATE won't stop the function if executed with elevated privileges.
-- Actually, the API path uses service_role, which bypasses RLS anyway. But SECURITY DEFINER is good practice
-- if we ever wanted to call it via the normal client (though we won't here, as the API intercepts it first).
CREATE OR REPLACE FUNCTION update_user_location_rpc(
    p_user_id UUID,
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We just insert a new location row as user_locations is designed as an append-only/updated history table
  -- or we upsert if we want to keep one row per user. The previous migration used gen_random_uuid() for primary key
  -- meaning it was an append-only history table. Let's keep it that way.
  INSERT INTO public.user_locations (user_id, location, updated_at)
  VALUES (
      p_user_id, 
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), 
      NOW()
  );
END;
$$;

-- Revoke execute permissions from public and authenticated to prevent direct client calls
-- This enforces that all location updates must pass through the /api/user/location velocity check
REVOKE EXECUTE ON FUNCTION public.update_user_location_rpc(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_user_location_rpc(UUID, DOUBLE PRECISION, DOUBLE PRECISION) FROM authenticated;

