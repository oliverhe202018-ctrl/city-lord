import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { haversineDistanceKm } from "@/lib/geometry-utils";
import * as Sentry from "@sentry/nextjs";

// Lazy-init: do NOT call createClient at module load time.
// Top-level initialization throws "supabaseUrl is required" during Next.js build
// when env vars are absent (CI dummy values or missing secrets).
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseServiceRoleKey) {
            throw new Error("[api/user/location] Missing Supabase env vars — NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required at runtime.");
        }
        _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    return _supabaseAdmin;
}

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

        const supabaseAdmin = getSupabaseAdmin();

        // Fetch user's last known location
        const { data: lastLocation, error: fetchErr } = await supabaseAdmin
            .from("user_locations")
            .select("updated_at, location")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle() as { data: { updated_at: string | null; location: unknown } | null; error: any };

        // Supabase postgREST returns GeoJSON for geometry columns by default.
        // Example: { "type": "Point", "coordinates": [lng, lat] }
        let isSpeeding = false;
        let calculatedSpeed = 0;

        if (lastLocation) {
            const locationData = lastLocation.location as unknown as { coordinates: [number, number] } | null;
            const updatedAt = lastLocation.updated_at;
            
            if (locationData?.coordinates && updatedAt) {
                const lastLng = locationData.coordinates[0];
                const lastLat = locationData.coordinates[1];
                const lastTime = new Date(updatedAt).getTime();

                const timeDiffHours = (now - lastTime) / (1000 * 60 * 60);

                if (timeDiffHours > 0) {
                    const distanceKm = haversineDistanceKm(lastLat, lastLng, latitude, longitude);
                    calculatedSpeed = distanceKm / timeDiffHours;

                    if (calculatedSpeed > MAX_SPEED_KMH) {
                        isSpeeding = true;
                    }
                }
            }
        }

        if (isSpeeding) {
            // Write anti-cheat log silently
            try {
                await supabaseAdmin.from("suspicious_location_report").insert({
                    user_id: user.id,
                    type: "map_teleport",
                    location: { lat: latitude, lng: longitude },
                    reported_speed: calculatedSpeed
                } as any);
            } catch (logErr) {
                console.error("[AntiCheat] Failed to write suspicious report:", logErr);
            }

            return NextResponse.json(
                { error: "Speed limit exceeded", code: "LOCATION_VELOCITY_EXCEEDED" },
                { status: 400 }
            );
        }

        // If validation passes, save the new location
        const { error: insertErr } = await supabaseAdmin.rpc("update_user_location_rpc" as any, {
            p_user_id: user.id,
            p_lat: latitude,
            p_lng: longitude
        } as any);

        if (insertErr) {
            console.error("[api/user/location] Failed to insert location via RPC:", insertErr);
            Sentry.captureException(insertErr, { tags: { feature: 'location', action: 'rpc_write' } });
            return NextResponse.json({ error: "Failed to save location" }, { status: 500 });
        }

        return NextResponse.json({ success: true, speed: calculatedSpeed });

    } catch (error: any) {
        console.error("[api/user/location] Error:", error.message);
        Sentry.captureException(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
