/**
 * HotZoneService
 *
 * Determines whether a territory is a "hot zone" (频繁易主的热门区域)
 * and provides score multipliers accordingly.
 *
 * Hot Zone Definition:
 *   A territory with >= 2 REAL ownership transfers (A→B, not A→neutral)
 *   within the last 7 days, counted from territory_owner_change_logs.
 *
 * Scoring Rules (FINAL):
 *   - Hot Zone capture:  0.5x score  (reduced reward for contested territory)
 *   - Normal capture:    1.0x score
 *   - Loss penalty:      0.5x of original score (both hot/normal)
 *   - Base score:        1000 points per km²
 */

import { prisma } from '@/lib/prisma'
import {
    HOT_ZONE_THRESHOLD,
    HOT_ZONE_WINDOW_DAYS,
    HOT_ZONE_CAPTURE_MULTIPLIER,
    NORMAL_CAPTURE_MULTIPLIER,
    LOSS_PENALTY_RATIO,
    BASE_SCORE_PER_KM2,
} from '@/lib/constants/territory'

// ============================================================
// Types
// ============================================================

export interface HotZoneStatus {
    isHotZone: boolean
    /** Real ownership transfers in 7-day window */
    recentChangeCount: number
    captureMultiplier: number
    lossMultiplier: number
}

export interface ScoreCalculation {
    baseScore: number
    multiplier: number
    finalScore: number
    isHotZone: boolean
}

export interface OwnerChangeRecord {
    previousOwner: string | null
    newOwner: string
    changedAt: Date
}

// ============================================================
// Service
// ============================================================

export const HotZoneService = {
    /**
     * Check whether a territory qualifies as a hot zone.
     *
     * Uses territory_owner_change_logs to count REAL ownership transfers
     * (A→B only) within the 7-day window. This is more accurate than
     * the cumulative owner_change_count field.
     */
    async getHotZoneStatus(territoryId: string): Promise<HotZoneStatus> {
        const windowStart = new Date()
        windowStart.setDate(windowStart.getDate() - HOT_ZONE_WINDOW_DAYS)

        // Count real owner changes in the 7-day window
        const recentChanges = await prisma.territory_owner_change_logs.count({
            where: {
                territory_id: territoryId,
                changed_at: { gte: windowStart },
            },
        })

        const isHotZone = recentChanges >= HOT_ZONE_THRESHOLD

        return {
            isHotZone,
            recentChangeCount: recentChanges,
            captureMultiplier: isHotZone
                ? HOT_ZONE_CAPTURE_MULTIPLIER
                : NORMAL_CAPTURE_MULTIPLIER,
            lossMultiplier: LOSS_PENALTY_RATIO,
        }
    },

    /**
     * Simple boolean check for hot zone status.
     */
    async isHotZone(territoryId: string): Promise<boolean> {
        const status = await this.getHotZoneStatus(territoryId)
        return status.isHotZone
    },

    /**
     * Get the score multiplier for a territory capture.
     */
    async getScoreMultiplier(territoryId: string): Promise<number> {
        const status = await this.getHotZoneStatus(territoryId)
        return status.captureMultiplier
    },

    /**
     * Calculate the score for capturing a territory.
     */
    async calculateCaptureScore(
        areaM2: number,
        territoryId: string
    ): Promise<ScoreCalculation> {
        const status = await this.getHotZoneStatus(territoryId)
        const areaKm2 = areaM2 / 1_000_000
        const baseScore = Math.round(areaKm2 * BASE_SCORE_PER_KM2)

        return {
            baseScore,
            multiplier: status.captureMultiplier,
            finalScore: Math.round(baseScore * status.captureMultiplier),
            isHotZone: status.isHotZone,
        }
    },

    /**
     * Calculate the score penalty for losing a territory.
     */
    calculateLossPenalty(originalScore: number): number {
        return Math.round(originalScore * LOSS_PENALTY_RATIO)
    },

    /**
     * Get recent ownership change history for display in HotZoneInfoSheet.
     */
    async getRecentChanges(
        territoryId: string,
        limit: number = 10
    ): Promise<OwnerChangeRecord[]> {
        const windowStart = new Date()
        windowStart.setDate(windowStart.getDate() - HOT_ZONE_WINDOW_DAYS)

        const logs = await prisma.territory_owner_change_logs.findMany({
            where: {
                territory_id: territoryId,
                changed_at: { gte: windowStart },
            },
            orderBy: { changed_at: 'desc' },
            take: limit,
        })

        return logs.map((l) => ({
            previousOwner: l.previous_owner,
            newOwner: l.new_owner,
            changedAt: l.changed_at ?? new Date(),
        }))
    },

    /**
     * Batch check hot zone status for multiple territories.
     * Useful for map rendering.
     */
    async batchCheckHotZones(
        territoryIds: string[]
    ): Promise<Map<string, boolean>> {
        if (territoryIds.length === 0) return new Map()

        const windowStart = new Date()
        windowStart.setDate(windowStart.getDate() - HOT_ZONE_WINDOW_DAYS)

        // Group count of owner_change_logs per territory in window
        const counts = await prisma.territory_owner_change_logs.groupBy({
            by: ['territory_id'],
            where: {
                territory_id: { in: territoryIds },
                changed_at: { gte: windowStart },
            },
            _count: { id: true },
        })

        const result = new Map<string, boolean>()
        for (const c of counts) {
            result.set(c.territory_id, c._count.id >= HOT_ZONE_THRESHOLD)
        }

        // Mark missing territories as non-hot
        for (const id of territoryIds) {
            if (!result.has(id)) result.set(id, false)
        }

        return result
    },

    // Export constants for use in other modules
    constants: {
        HOT_ZONE_THRESHOLD,
        HOT_ZONE_WINDOW_DAYS,
        HOT_ZONE_CAPTURE_MULTIPLIER,
        NORMAL_CAPTURE_MULTIPLIER,
        LOSS_PENALTY_RATIO,
        BASE_SCORE_PER_KM2,
    },
}
