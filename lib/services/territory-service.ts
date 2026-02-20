/**
 * TerritoryService
 * 
 * Shared territory creation logic for phone and watch data sources.
 * Ensures consistent loop-closure thresholds and polygon area calculation
 * regardless of data origin.
 * 
 * CRITICAL: Both useRunningTracker (phone) and ActivityService (watch)
 * must use the SAME constants from geometry-utils.ts.
 */

import { prisma } from '@/lib/prisma';
import * as turf from '@turf/turf';
import {
    isLoopClosed,
    calculatePathDistance,
    LOOP_CLOSURE_THRESHOLD_M,
    MIN_TERRITORY_AREA_M2,
    MIN_LOOP_POINTS,
    type GeoPoint,
} from '@/lib/geometry-utils';

// ============================================================
// Types
// ============================================================

export interface TerritoryCreationInput {
    /** Cleaned GPS points forming the trajectory */
    points: GeoPoint[];
    /** Data source identifier */
    source: 'phone' | 'watch' | 'gpx' | 'manual';
    /** Duration in seconds */
    duration: number;
}

export interface TerritoryCreationResult {
    success: boolean;
    runId?: string;
    /** Area in m² */
    area?: number;
    territoryCreated: boolean;
    error?: string;
}

// ============================================================
// Service
// ============================================================

export const TerritoryService = {
    /**
     * Create a territory from a GPS path.
     * 
     * 1. Checks if the path forms a closed loop (same threshold as phone: 20m)
     * 2. Calculates polygon area via turf.js (same as useRunningTracker)
     * 3. If area >= 100m², creates run + records polygon in a single transaction
     * 
     * @param userId - The authenticated user's ID
     * @param input  - Cleaned GPS points, source, and duration
     */
    async createFromPath(
        userId: string,
        input: TerritoryCreationInput
    ): Promise<TerritoryCreationResult> {
        const { points, source, duration } = input;

        // Validate minimum point count
        if (points.length < MIN_LOOP_POINTS) {
            return {
                success: false,
                territoryCreated: false,
                error: `轨迹点数不足（需要至少 ${MIN_LOOP_POINTS} 个点，当前 ${points.length} 个）`,
            };
        }

        // Check loop closure
        const loopCheck = isLoopClosed(points, LOOP_CLOSURE_THRESHOLD_M);
        if (!loopCheck.isClosed) {
            return {
                success: false,
                territoryCreated: false,
                error: `轨迹未闭合（起点终点距离 ${Math.round(loopCheck.gapDistance)}m > ${LOOP_CLOSURE_THRESHOLD_M}m 阈值）`,
            };
        }

        // Calculate polygon area using turf.js (consistent with useRunningTracker)
        const coords = points.map(p => [p.lng, p.lat]);
        // Ensure closed ring
        if (
            coords[0][0] !== coords[coords.length - 1][0] ||
            coords[0][1] !== coords[coords.length - 1][1]
        ) {
            coords.push(coords[0]);
        }

        let polyArea: number;
        try {
            const polygon = turf.polygon([coords]);
            polyArea = turf.area(polygon);
        } catch (e) {
            return {
                success: false,
                territoryCreated: false,
                error: `多边形计算失败：${e instanceof Error ? e.message : String(e)}`,
            };
        }

        if (polyArea < MIN_TERRITORY_AREA_M2) {
            return {
                success: false,
                territoryCreated: false,
                error: `领地面积过小（${Math.round(polyArea)}m² < ${MIN_TERRITORY_AREA_M2}m² 最低要求）`,
            };
        }

        // Calculate total path distance
        const totalDistance = calculatePathDistance(points);

        // Persist in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create run record (consistent with saveRunActivity)
            const run = await tx.runs.create({
                data: {
                    user_id: userId,
                    distance: totalDistance,
                    duration: duration,
                    path: points.map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp })),
                    polygons: [points.map(p => ({ lat: p.lat, lng: p.lng, timestamp: p.timestamp }))],
                    area: polyArea,
                    status: 'completed',
                    source: source,
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            });

            // Update user profile stats
            await tx.profiles.update({
                where: { id: userId },
                data: {
                    total_distance_km: { increment: totalDistance / 1000 },
                    total_area: { increment: polyArea },
                },
            });

            return { runId: run.id };
        }, {
            maxWait: 5000,
            timeout: 10000
        });

        return {
            success: true,
            runId: result.runId,
            area: polyArea,
            territoryCreated: true,
        };
    },
};
