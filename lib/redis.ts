import Redis from 'ioredis'

let _redisClient: Redis | null = null;
const globalForRedis = global as unknown as { redis: Redis };

export const redis = new Proxy({} as Redis, {
    get(target, prop) {
        if (!_redisClient) {
            if (globalForRedis.redis) {
                _redisClient = globalForRedis.redis;
            } else {
                const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
                _redisClient = new Redis(redisUrl, {
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    connectTimeout: 5000,
                    commandTimeout: 3000,
                    retryStrategy(times) {
                        if (times > 3) return null;
                        return Math.min(times * 200, 2000);
                    },
                });
                _redisClient.on('error', (err) => {
                    console.warn('[Redis] Connection error (non-fatal):', err.message);
                });
                if (process.env.NODE_ENV !== 'production') {
                    globalForRedis.redis = _redisClient;
                }
            }
        }
        return Reflect.get(_redisClient, prop);
    }
});
