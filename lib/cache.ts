import { redis } from '@/lib/redis'

/**
 * Fetch data with transparent Redis caching.
 * If Redis is down or the cache miss, falls through to `fetchFn` silently.
 *
 * @param key   - Redis key (e.g., "profile:{userId}")
 * @param ttl   - TTL in seconds
 * @param fetchFn - Async function to fetch fresh data from DB
 */
export async function cachedFetch<T>(
    key: string,
    ttl: number,
    fetchFn: () => Promise<T>
): Promise<T> {
    // 1. Try cache
    try {
        const cached = await redis.get(key)
        if (cached) {
            return JSON.parse(cached) as T
        }
    } catch (err) {
        // Redis down — silently fall through to DB
        console.warn('[cache] Redis get failed:', (err as Error).message)
    }

    // 2. Cache miss — fetch from DB
    const data = await fetchFn()

    // 3. Write back to cache (fire-and-forget)
    try {
        await redis.setex(key, ttl, JSON.stringify(data))
    } catch (err) {
        console.warn('[cache] Redis setex failed:', (err as Error).message)
    }

    return data
}

/**
 * Invalidate one or more cache keys.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
        await redis.del(...keys)
    } catch (err) {
        console.warn('[cache] Redis del failed:', (err as Error).message)
    }
}

/**
 * Simple rate limiter — returns true if the action is ALLOWED.
 * Uses a sliding window counter.
 *
 * @param key       - Rate limit key (e.g., "rl:auth:user@example.com")
 * @param windowSec - Window duration in seconds
 * @param maxHits   - Max allowed hits in the window
 */
export async function rateLimit(
    key: string,
    windowSec: number,
    maxHits: number
): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
    try {
        const current = await redis.incr(key)
        if (current === 1) {
            // First hit — set the TTL
            await redis.expire(key, windowSec)
        }
        const ttl = await redis.ttl(key)

        if (current > maxHits) {
            return { allowed: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec }
        }

        return { allowed: true, remaining: maxHits - current, retryAfterSec: 0 }
    } catch (err) {
        // If Redis is down, allow the action (fail open)
        console.warn('[cache] Rate limit Redis error:', (err as Error).message)
        return { allowed: true, remaining: maxHits, retryAfterSec: 0 }
    }
}
