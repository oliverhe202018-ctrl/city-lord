import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveRunActivity } from "@/app/actions/run-service";

/**
 * POST /api/run/save-pending
 *
 * Receives a failed run payload from the client (stored in localStorage)
 * and retries the save operation server-side.
 * Called by PendingRunUploadRetry on app start.
 */
export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json() as {
            distanceMeters: number;
            durationSeconds: number;
            steps: number;
            area: number;
            calories: number;
        };

        const result = await saveRunActivity(user.id, {
            distance: body.distanceMeters,
            duration: body.durationSeconds,
            path: [], // Path not stored in pending cache (too large)
            polygons: [],
            manualLocationCount: 0,
        });

        if (result.success) {
            return NextResponse.json({ success: true, runId: result.runId });
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[/api/run/save-pending] Error:", message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
