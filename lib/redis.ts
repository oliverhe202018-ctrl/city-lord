import Redis from 'ioredis'

// In a real application, provide the REDIS_URL environment variable.
// Example: redis://default:redispw@localhost:49153
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

const globalForRedis = global as unknown as { redis: Redis }

export const redis =
    globalForRedis.redis ||
    new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
    })

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis
