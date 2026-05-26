import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { prisma } from "@/lib/prisma";
import { RunRecordDTO } from "@/types/run-sync";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json() as RunRecordDTO;

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

                        if (speed > 60) {
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
            }
        }

        if (body.idempotencyKey) {
            const existingRun = await prisma.runs.findUnique({
                where: { idempotency_key: body.idempotencyKey }
            });

            if (existingRun) {
                console.warn(`[/api/run/save-pending] Run with idempotencyKey ${body.idempotencyKey} already exists. Returning success.`);
                return NextResponse.json({
                    success: true,
                    runId: existingRun.id,
                    settlingAsync: true,
                    duplicate: true
                });
            }
        }

        const run = await prisma.runs.create({
            data: {
                user_id: user.id,
                status: 'pending',
                idempotency_key: body.idempotencyKey,
                distance: body.distance,
                duration: body.duration,
                path: body.path || [],
                polygons: body.polygons || [],
                club_id: body.clubId ?? null,
                totalSteps: body.totalSteps,
                eventsLog: body.eventsHistory || [],
                created_at: new Date(body.timestamp || Date.now()),
            }
        });

        try {
            await tasks.trigger("run-settlement", { runId: run.id });
        } catch (triggerErr) {
            console.error("[Trigger.dev] Failed to enqueue run-settlement:", triggerErr);
        }

        return NextResponse.json({
            success: true,
            runId: run.id,
            settlingAsync: true
        });

    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[/api/run/save-pending] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
