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
