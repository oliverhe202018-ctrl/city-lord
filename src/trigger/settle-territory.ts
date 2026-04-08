import { task } from "@trigger.dev/sdk/v3";
import { isLoopClosed, LOOP_CLOSURE_THRESHOLD_M } from "@/lib/geometry-utils";
import * as turf from "@turf/turf";
import { processTerritorySettlement } from "@/lib/territory/settlement";
import { prisma } from "@/lib/prisma";
import { TaskService } from "@/lib/services/task";
import { updateChallengeProgress } from "@/app/actions/challenge-service";

interface RunPoint {
    lng: number;
    lat: number;
    timestamp?: number;
}


export const settleTerritoriesTask = task({
    id: "settle-territories",
    maxDuration: 600, // 10 minutes max duration for heavily overlapping large claims
    run: async (payload: {
        runId: string;
        userId: string;
        cityId: string;
        clubId: string | null;
        polygons: RunPoint[][];
        distance: number;
        duration: number;
    }) => {
        const { runId, userId, cityId, clubId, polygons, distance, duration } = payload;
        let settledCount = 0;
        let reinforcedCount = 0;

        console.log(`[Trigger] Starting backend settlement for run ${runId}`);

        // 1. Process Territories
        if (polygons && polygons.length > 0) {
            for (const polyPoints of polygons) {
                const loopCheck = isLoopClosed(
                    polyPoints.map((pt: RunPoint, i: number) => ({ ...pt, timestamp: pt.timestamp ?? i })),
                    LOOP_CLOSURE_THRESHOLD_M
                );
                if (!loopCheck.isClosed) continue;

                const coords = polyPoints.map((p: RunPoint) => [p.lng, p.lat] as [number, number]);
                if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                    coords.push([...coords[0]]);
                }

                // RISK-04: Coordinate sanity guard — reject points outside plausible China bounds
                // GeoJSON order is [lng, lat]; lng ∈ [70,140], lat ∈ [3,55] for mainland China
                const invalidCoords = coords.filter(([lng, lat]) =>
                    isNaN(lng) || isNaN(lat) ||
                    lat < -90 || lat > 90 ||
                    lng < -180 || lng > 180 ||
                    lat < 3 || lat > 55 ||   // rough China bounding box
                    lng < 70 || lng > 140
                );
                if (invalidCoords.length > 0) {
                    console.warn(`[Territory] Polygon for run ${runId} has ${invalidCoords.length} invalid coord(s) — first invalid: [${invalidCoords[0]}]. Skipping.`);
                    continue;
                }

                // RISK-03: Minimum vertex guard to prevent turf.polygon from throwing
                if (coords.length < 4) {
                    console.warn(`[Territory] Skipping polygon with only ${coords.length} coordinates (need >= 4) for run ${runId}`);
                    continue;
                }

                try {
                    const polyFeature = turf.polygon([coords]);
                    const settlement = await processTerritorySettlement({
                        runId,
                        userId,
                        cityId,
                        clubId,
                        pathGeoJSON: polyFeature,
                        preProcessedPolygons: [polyFeature]
                    });

                    if (settlement.success) {
                        settledCount += settlement.createdTerritories;
                        reinforcedCount += settlement.reinforcedTerritories;
                    }
                } catch (error) {
                    console.error(`[Territory Settlement Failed] runId: ${runId}`, error);
                }
            }

            if (settledCount > 0) {
                await prisma.user_city_progress.update({
                    where: { user_id_city_id: { user_id: userId, city_id: cityId } },
                    data: { tiles_captured: { increment: settledCount } }
                }).catch((e: Error) => console.error('[Settlement] Failed to update tiles_captured', e));
                console.log(`[Background Settlement] Successfully processed ${settledCount} territories for run ${runId}`);
            }

            // Update runs table with counts
            try {
                await prisma.runs.update({
                    where: { id: runId },
                    data: {
                        new_territories_count: settledCount,
                        reinforced_territories_count: reinforcedCount
                    }
                });
            } catch (err) {
                console.error(`[Settlement] Failed to update runs table counts for run ${runId}`, err);
            }
        }

        // 2. Task Center Event
        try {
            const eventPayload = {
                type: 'RUN_FINISHED' as const,
                userId: userId,
                timestamp: new Date(),
                data: {
                    distance: distance, // meters
                    duration: duration, // seconds
                    pace: distance > 0 ? (duration / (distance / 1000)) : 0, // s/km
                }
            };
            await TaskService.processEvent(userId, eventPayload);
            console.log(`[Task] Event processed in background for user: ${userId}`);
        } catch (taskError) {
            console.error('[Task] Event processing failed', taskError);
        }

        // 3. Challenge Progress
        try {
            const paceSecondsPerKm = distance > 0
                ? duration / (distance / 1000)
                : 0;
            await updateChallengeProgress(userId, {
                distance_meters: distance,
                hexes_claimed: settledCount, // Record actual claimed tiles asynchronously
                pace_seconds_per_km: paceSecondsPerKm,
            });
            console.log(`[Challenge] Progress updated in background for user: ${userId}`);
        } catch (challengeError) {
            console.error('[Challenge] Progress update failed', challengeError);
        }

        // RISK-02: 状态回写 — 将 run 标记为已结算
        try {
            await prisma.runs.update({
                where: { id: runId },
                data: {
                    status: 'completed',
                    updated_at: new Date(),
                }
            });
            console.log(`[Settlement] Run ${runId} marked as completed`);
        } catch (statusErr) {
            console.error(`[Settlement] Failed to update run status for ${runId}`, statusErr);
        }

        return { settledCount, reinforcedCount, runId, distance, duration };
    }
});
