import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveRunActivity } from "@/app/actions/run-service";
import { RunRecordDTO } from "@/types/run-sync";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json() as RunRecordDTO;

        // Anti-Cheat: Cross-segment speed check against last known map location
        if (body.path && body.path.length > 0) {
            try {
                const firstPoint = body.path[0];
                const supabaseAdmin = (await import("@supabase/supabase-js")).createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    { auth: { autoRefreshToken: false, persistSession: false } }
                );

                const { data: lastLocation } = await supabaseAdmin
                    .from("user_locations")
                    .select("updated_at, location")
                    .eq("user_id", user.id)
                    .order("updated_at", { ascending: false })
                    .limit(1)
                    .single();

                if (lastLocation && lastLocation.location && lastLocation.location.coordinates) {
                    const lastLng = lastLocation.location.coordinates[0];
                    const lastLat = lastLocation.location.coordinates[1];
                    const lastTime = new Date(lastLocation.updated_at).getTime();
                    const timeDiffHours = (Date.now() - lastTime) / (1000 * 60 * 60);

                    if (timeDiffHours > 0) {
                        const { haversineDistanceKm } = await import("@/lib/geometry-utils");
                        const speed = haversineDistanceKm(lastLat, lastLng, firstPoint.lat, firstPoint.lng) / timeDiffHours;

                        if (speed > 300) {
                            await supabaseAdmin.from("suspicious_location_report").insert({
                                user_id: user.id,
                                type: "run_session_teleport",
                                location: { lat: firstPoint.lat, lng: firstPoint.lng },
                                reported_speed: speed
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("[AntiCheat] Failed to write suspicious report:", e);
                // Do not rethrow, do not block run progression
            }
        }

        // Make sure missing props are replaced by empty defaults from DTO contract
        const result = await saveRunActivity(user.id, {
            idempotencyKey: body.idempotencyKey,
            distance: body.distance,
            duration: body.duration,
            path: body.path || [],
            polygons: body.polygons || [],
            timestamp: body.timestamp || Date.now(),
            calories: body.calories,
            steps: body.steps,
        });

        if (result.success) {
            return NextResponse.json({ success: true, runId: result.data?.runId });
        } else {
            return NextResponse.json({ error: result.error || "Save failed" }, { status: 500 });
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[/api/run/save-pending] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
