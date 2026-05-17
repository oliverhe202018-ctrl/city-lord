/**
 * ActivityService
 * * Watch-specific data processing pipeline:
 * validate → clean (drift filter) → detect loop → persist → territory creation
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
    filterDriftPoints,
    isLoopClosed,
    calculatePathDistance,
    validateHumanLimits,
    LOOP_CLOSURE_THRESHOLD_M,
    ABSOLUTE_SPEED_LIMIT_KMH,
    type GeoPoint,
} from '@/lib/geometry-utils';
import { TerritoryService } from './territory-service';
import type {
    WatchSyncPayload,
    WatchSyncResult,
    WatchTrackPoint,
} from '@/types/watch-sync';

// ============================================================
// Helpers
// ============================================================

/** Convert WatchTrackPoint[] to GeoPoint[] */
function toGeoPoints(points: WatchTrackPoint[]): GeoPoint[] {
    return points.map(p => ({
        lat: p.lat,
        lng: p.lng,
        timestamp: p.timestamp,
    }));
}

/** Calculate duration from summary timestamps */
function calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    return Math.max(0, Math.floor((end - start) / 1000));
}

// ============================================================
// Service
// ============================================================

export interface ProcessWatchDataOptions {
    /** External system's unique ID for this activity (e.g. HealthKit UUID). Used for deduplication. */
    externalId?: string;
    /** Human-readable source app name (e.g. "HealthKit", "Strava", "Garmin"). */
    sourceApp?: string;
    /** Full unprocessed original payload for debugging. */
    rawData?: unknown;
}

export const ActivityService = {
    /**
     * Process a smartwatch data payload end-to-end.
     * * Pipeline:
     * 1. Validate human limits (heart rate, speed)
     * 2. Filter GPS drift points
     * 3. Detect loop closure
     * 4. Persist watch_activities record (idempotent via external_id)
     * 5. If loop closed → call TerritoryService.createFromPath
     * 6. Update watch_activities with result
     */
    async processWatchData(
        userId: string,
        payload: WatchSyncPayload,
        options: ProcessWatchDataOptions = {}
    ): Promise<WatchSyncResult> {
        const { externalId, sourceApp, rawData } = options;
        const warnings: string[] = [];
        let createdActivityId: string | null = null;

        try {
            // ------------------------------------------------------
            // 1. Validate human limits on point data
            // ------------------------------------------------------
            for (const point of payload.points) {
                if (point.heartRate !== undefined) {
                    const hrCheck = validateHumanLimits(point.heartRate);
                    if (!hrCheck.valid) {
                        return { success: false, error: hrCheck.reason };
                    }
                }
            }

            // Check overall speed (total distance / total time)
            const durationSec = calculateDuration(payload.summary.startTime, payload.summary.endTime);
            if (durationSec > 0) {
                const avgSpeedKmh = (payload.summary.totalDistance / 1000) / (durationSec / 3600);
                const speedCheck = validateHumanLimits(undefined, avgSpeedKmh);
                if (!speedCheck.valid) {
                    return { success: false, error: speedCheck.reason };
                }
            }

            // ------------------------------------------------------
            // 2. Filter GPS drift points
            // ------------------------------------------------------
            const rawGeoPoints = toGeoPoints(payload.points);
            const driftResult = filterDriftPoints(rawGeoPoints, ABSOLUTE_SPEED_LIMIT_KMH);
            if (driftResult.warnings.length > 0) {
                warnings.push(...driftResult.warnings);
            }

            const cleanedPoints = driftResult.cleanedPoints;

            if (cleanedPoints.length < 2) {
                return {
                    success: false,
                    error: '有效轨迹点不足 2 个，无法处理',
                    warnings,
                };
            }

            // ------------------------------------------------------
            // 3. Detect loop closure
            // ------------------------------------------------------
            const loopCheck = isLoopClosed(cleanedPoints, LOOP_CLOSURE_THRESHOLD_M);
            const pathDistance = calculatePathDistance(cleanedPoints);

            // ------------------------------------------------------
            // 4. Persist watch_activities (Transaction)
            // ------------------------------------------------------
            const result = await prisma.$transaction(async (tx) => {
                // A. Deduplication Check
                if (externalId) {
                    // Use findFirst instead of findUnique to be safe if the composite index is missing or named differently
                    const existing = await tx.watch_activities.findFirst({
                        where: {
                            user_id: userId,
                            external_id: externalId
                        },
                        select: { id: true },
                    });

                    if (existing) {
                        return { activityId: existing.id, isDuplicate: true };
                    }
                }

                // B. Create Record
                // If it's a loop, we set status to 'pending' because we are about to process territory
                // If it's NOT a loop, we set status to 'processed' because we are done
                const initialStatus = loopCheck.isClosed ? 'pending' : 'processed';

                const activity = await tx.watch_activities.create({
                    data: {
                        user_id: userId,
                        source: 'watch',
                        source_app: sourceApp ?? null,
                        external_id: externalId ?? null,
                        // Prisma requires strictly typed JSON. JSON.stringify+parse removes undefined values.
                        raw_points: JSON.parse(JSON.stringify(payload.points)) as Prisma.InputJsonValue,
                        summary: JSON.parse(JSON.stringify(payload.summary)) as Prisma.InputJsonValue,
                        cleaned_points: JSON.parse(JSON.stringify(cleanedPoints)) as Prisma.InputJsonValue,
                        raw_data: rawData ? JSON.parse(JSON.stringify(rawData)) as Prisma.InputJsonValue : Prisma.JsonNull,
                        point_count: cleanedPoints.length,
                        is_loop: loopCheck.isClosed,
                        loop_distance: loopCheck.gapDistance === Infinity ? null : loopCheck.gapDistance,
                        total_distance: pathDistance,
                        status: initialStatus,
                    },
                });

                return { activityId: activity.id, isDuplicate: false };
            }, {
                maxWait: 5000,
                timeout: 10000
            });

            // Handle Deduplication Return
            if (result.isDuplicate) {
                return {
                    success: true,
                    activityId: result.activityId,
                    territoryCreated: false,
                    error: '该活动记录已存在，跳过重复导入',
                    warnings: ['Duplicate: activity already imported'],
                };
            }

            createdActivityId = result.activityId;

            // ------------------------------------------------------
            // 5. Territory Creation (If Loop Closed)
            // ------------------------------------------------------
            if (loopCheck.isClosed) {
                try {
                    // Call TerritoryService (It handles its own geometry calculation & transaction for runs/territories)
                    // Note: Ensure createFromPath signature matches your TerritoryService implementation
                    const territoryResult = await TerritoryService.createFromPath(userId, {
                        points: cleanedPoints,
                        source: 'watch',
                        duration: durationSec,
                    });

                    // 6. Update watch_activities with success/failure result
                    await prisma.watch_activities.update({
                        where: { id: createdActivityId },
                        data: {
                            run_id: territoryResult.runId || null,
                            territory_area: territoryResult.area || null,
                            status: territoryResult.success ? 'processed' : 'failed',
                            error_message: territoryResult.error || null,
                        },
                    });

                    return {
                        success: territoryResult.success,
                        activityId: createdActivityId,
                        runId: territoryResult.runId,
                        territoryCreated: territoryResult.territoryCreated,
                        territoryArea: territoryResult.area,
                        error: territoryResult.error,
                        warnings: warnings.length > 0 ? warnings : undefined,
                    };

                } catch (territoryError) {
                    // If territory creation crashed unexpectedly
                    throw territoryError; // Will be caught by outer catch
                }
            }

            // ------------------------------------------------------
            // 7. Loop Not Closed (Success but no territory)
            // ------------------------------------------------------
            return {
                success: true,
                activityId: createdActivityId,
                territoryCreated: false,
                error: `轨迹未闭合（缺口 ${Math.round(loopCheck.gapDistance)}m > ${LOOP_CLOSURE_THRESHOLD_M}m），仅保存跑步记录`,
                warnings: warnings.length > 0 ? warnings : undefined,
            };

        } catch (e) {
            console.error('[ActivityService] processWatchData error:', e);

            // Safety Net: If we created an activity but crashed later, mark it as failed
            if (createdActivityId) {
                try {
                    await prisma.watch_activities.update({
                        where: { id: createdActivityId },
                        data: {
                            status: 'failed',
                            error_message: e instanceof Error ? e.message : String(e),
                        }
                    });
                } catch (updateErr) {
                    console.error('Failed to update status to failed:', updateErr);
                }
            }

            return {
                success: false,
                error: `处理失败：${e instanceof Error ? e.message : String(e)}`,
                warnings: warnings.length > 0 ? warnings : undefined,
            };
        }
    },
};