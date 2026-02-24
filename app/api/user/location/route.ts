import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { haversineDistanceKm } from "@/lib/geometry-utils";

// Initialize a service_role client to bypass RLS when writing/reading secure tables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(req: NextRequest) {
    try {
        // Authenticate the user calling the API
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { latitude, longitude, accuracy } = body;

        if (typeof latitude !== "number" || typeof longitude !== "number") {
            return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
        }

        // Base time on server reception time to prevent client timestamp tampering
        const now = Date.now();
        const MAX_SPEED_KMH = 300;

        // Fetch user's last known location
        const { data: lastLocation, error: fetchErr } = await supabaseAdmin
            .from("user_locations")
            .select("updated_at, location")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .single();

        if (lastLocation && !fetchErr) {
            // Extract WGS84 coordinates from PostGIS point text Representation if fetched as text
            // Note: Since location is a PostGIS geometry, Supabase client might return it in GeoJSON or EWKB depending on setup.
            // If it returns a string like "POINT(lng lat)", we need to parse it. 
            // Often it's safer to use an RPC `get_last_user_location` if we need the extracted lat/lng directly.
            // Let's assume we can fetch it via PostGIS specific select or RPC:
            // Since `select("...location")` returns the hex EWKB by default, let's write an RPC to get the last location easily, 
            // OR we can just query it with a Raw SQL via an RPC. 
            // Let's use RPC `get_last_user_location_rpc` which we will create below to make it bulletproof.
        }

        // Better Approach: Get last known lat/lng values explicitly using an RPC
        // Wait, instead of adding another RPC, we can just use the fact that geometry usually comes as string, but extracting is fragile.
        // Let's create `get_last_user_location_rpc` in the database to just return `lat` and `lng`.
        // I will add this to the migration briefly or write the logic to invoke the fetcher safely.

        // Actually, Supabase postgREST returns GeoJSON for geometry columns by default!
        // Example: { "type": "Point", "coordinates": [lng, lat] }
        let isSpeeding = false;
        let calculatedSpeed = 0;

        if (lastLocation && lastLocation.location && lastLocation.location.coordinates) {
            const lastLng = lastLocation.location.coordinates[0];
            const lastLat = lastLocation.location.coordinates[1];
            const lastTime = new Date(lastLocation.updated_at).getTime();

            const timeDiffHours = (now - lastTime) / (1000 * 60 * 60);

            if (timeDiffHours > 0) {
                const distanceKm = haversineDistanceKm(lastLat, lastLng, latitude, longitude);
                calculatedSpeed = distanceKm / timeDiffHours;

                if (calculatedSpeed > MAX_SPEED_KMH) {
                    isSpeeding = true;
                }
            }
        }

        if (isSpeeding) {
            // Write anti-cheat log silently
            try {
                await supabaseAdmin.from("suspicious_location_report").insert({
                    user_id: user.id,
                    type: "map_teleport",
                    location: { lat: latitude, lng: longitude }, // saved as JSONB
                    reported_speed: calculatedSpeed
                });
            } catch (logErr) {
                console.error("[AntiCheat] Failed to write suspicious report:", logErr);
                // Do not rethrow
            }

            return NextResponse.json(
                { error: "Speed limit exceeded", code: "LOCATION_VELOCITY_EXCEEDED" },
                { status: 400 }
            );
        }

        // If validation passes, save the new location
        const { error: insertErr } = await supabaseAdmin.rpc("update_user_location_rpc", {
            p_user_id: user.id,
            p_lat: latitude,
            p_lng: longitude
        });

        if (insertErr) {
            console.error("[api/user/location] Failed to insert location via RPC:", insertErr);
            return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
        }

        return NextResponse.json({ success: true, speed: calculatedSpeed });

    } catch (error: any) {
        console.error("[api/user/location] Error:", error.message);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
