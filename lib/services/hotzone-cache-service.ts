import { prisma } from '@/lib/prisma'
import {
    HOT_ZONE_THRESHOLD,
    HOT_ZONE_WINDOW_DAYS,
} from '@/lib/constants/territory'
import { redis } from '@/lib/redis'

/** Cache TTL in seconds (5 minutes) */
const CACHE_TTL_SEC = 5 * 60

export const HotZoneCacheService = {
    /**
     * Check if a territory is a hot zone.
     * Returns cached result if available and fresh; otherwise queries DB.
     */
    async isHotZone(territoryId: string): Promise<{ isHotZone: boolean; changeCount: number }> {
        const cacheKey = `hotzone:${territoryId}`

        // 1. Cache hit
        const cached = await redis.get(cacheKey)
        if (cached) {
            const parsed = JSON.parse(cached)
            return { isHotZone: parsed.isHotZone, changeCount: parsed.changeCount }
        }

        // 2. Cache miss — query DB
        const windowStart = new Date()
        windowStart.setDate(windowStart.getDate() - HOT_ZONE_WINDOW_DAYS)

        const changeCount = await prisma.territory_owner_change_logs.count({
            where: {
                territory_id: territoryId,
                changed_at: { gte: windowStart },
            },
        })

        const isHotZone = changeCount >= HOT_ZONE_THRESHOLD

        // 3. Store in cache
        await redis.setex(cacheKey, CACHE_TTL_SEC, JSON.stringify({ isHotZone, changeCount }))

        return { isHotZone, changeCount }
    },

    /**
     * Batch check multiple territories (for run settlement).
     * Queries DB only for cache-missed territories.
     */
    async batchCheck(
        territoryIds: string[]
    ): Promise<Map<string, { isHotZone: boolean; changeCount: number }>> {
        const result = new Map<string, { isHotZone: boolean; changeCount: number }>()
        if (territoryIds.length === 0) return result

        const missedIds: string[] = []

        const CHUNK_SIZE = 500
        for (let i = 0; i < territoryIds.length; i += CHUNK_SIZE) {
            const chunk = territoryIds.slice(i, i + CHUNK_SIZE)
            const keys = chunk.map(id => `hotzone:${id}`)
            const cachedValues = await redis.mget(keys)

            for (let j = 0; j < chunk.length; j++) {
                const id = chunk[j]
                const val = cachedValues[j]
                if (val) {
                    const parsed = JSON.parse(val)
                    result.set(id, { isHotZone: parsed.isHotZone, changeCount: parsed.changeCount })
                } else {
                    missedIds.push(id)
                }
            }
        }

        // 2. Batch query for misses
        if (missedIds.length > 0) {
            const windowStart = new Date()
            windowStart.setDate(windowStart.getDate() - HOT_ZONE_WINDOW_DAYS)

            // Chunk DB queries to avoid too many host variables
            const DB_CHUNK_SIZE = 500
            for (let i = 0; i < missedIds.length; i += DB_CHUNK_SIZE) {
                const chunk = missedIds.slice(i, i + DB_CHUNK_SIZE)
                const counts = await prisma.territory_owner_change_logs.groupBy({
                    by: ['territory_id'],
                    where: {
                        territory_id: { in: chunk },
                        changed_at: { gte: windowStart },
                    },
                    _count: { id: true },
                })

                const countMap = new Map(counts.map((c: any) => [c.territory_id, c._count.id]))
                const pipeline = redis.pipeline()

                for (const id of chunk) {
                    const changeCount = countMap.get(id) ?? 0
                    const isHotZone = changeCount >= HOT_ZONE_THRESHOLD

                    // Cache the result
                    pipeline.setex(`hotzone:${id}`, CACHE_TTL_SEC, JSON.stringify({ isHotZone, changeCount }))
                    result.set(id, { isHotZone, changeCount })
                }

                await pipeline.exec()
            }
        }

        return result
    },

    /**
     * Invalidate cache for a specific territory.
     * Call this after claimTerritory writes an owner_change_log.
     */
    async invalidate(territoryId: string): Promise<void> {
        await redis.del(`hotzone:${territoryId}`)
    },

    /**
     * Clear entire cache namespace (Hotzones only)
     * Useful for testing or after batch migrations.
     */
    async clear(): Promise<void> {
        const keys = await redis.keys('hotzone:*')
        if (keys.length > 0) {
            await redis.del(...keys)
        }
    }
}
