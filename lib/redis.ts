import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

const globalForRedis = global as unknown as { redis: Redis }

export const redis =
    globalForRedis.redis ||
    new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 3000,
        retryStrategy(times) {
            if (times > 3) return null // stop retrying after 3 attempts
            return Math.min(times * 200, 2000)
        },
    })

// Suppress unhandled error events (logged but don't crash)
redis.on('error', (err) => {
    console.warn('[Redis] Connection error (non-fatal):', err.message)
})

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
