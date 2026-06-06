
interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

import { isTester } from '@/lib/constants/anti-cheat';

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

const runSubmissionLimiter = new Map<string, RateLimitRecord>();
const MAX_MAP_SIZE = 10000;

/**
 * TODO (v1.x): 当前基于 In-Memory 的限流器在 Vercel Serverless 多实例并发下可被绕过。
 * 后续版本需接入 Redis / Upstash Rate Limit 以实现全局严格限流。
 *
 * Basic in-memory rate limiter for Run API.
 *
 * In a distributed Vercel Serverless environment, this restricts submissions
 * per cold-start instance, which is enough to thwart naive tight loops.
 *
 * 驱逐策略说明：当前使用 FIFO 驱逐（按插入顺序），非真正的 LRU。
 * 由于 Map.keys() 返回插入顺序迭代器，slice + delete 实现的是先进先出。
 */
export async function checkRunRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    // [God Mode] Tester Whitelist Bypass
    if (await isTester(userId)) {
        return { allowed: true };
    }

    const config: RateLimitConfig = { maxRequests: 2, windowMs: 10000 }; // Max 2 runs every 10 seconds
    const now = Date.now();

    const record = runSubmissionLimiter.get(userId);

    if (!record) {
        // FIFO 驱逐（按插入顺序）：删除最早的一批条目
        if (runSubmissionLimiter.size > MAX_MAP_SIZE) {
            const oldestKeys = [...runSubmissionLimiter.keys()].slice(0, 1000);
            oldestKeys.forEach(k => runSubmissionLimiter.delete(k));
        }

        runSubmissionLimiter.set(userId, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true };
    }

    if (now > record.resetAt) {
        record.count = 1;
        record.resetAt = now + config.windowMs;
        runSubmissionLimiter.set(userId, record);
        return { allowed: true };
    }

    if (record.count >= config.maxRequests) {
        return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
    }

    record.count += 1;
    runSubmissionLimiter.set(userId, record);
    return { allowed: true };
}
