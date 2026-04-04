import { isTester } from "../constants/anti-cheat";

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
 * Basic in-memory rate limiter for Run API.
 * 
 * In a distributed Vercel Serverless environment, this restricts submissions
 * per cold-start instance, which is enough to thwart naive tight loops.
 */
export function checkRunRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
    // [God Mode] Tester Whitelist Bypass
    if (isTester(userId)) {
        return { allowed: true };
    }

    const config: RateLimitConfig = { maxRequests: 2, windowMs: 10000 }; // Max 2 runs every 10 seconds
    const now = Date.now();

    const record = runSubmissionLimiter.get(userId);

    if (!record) {
        // Basic memory management: Clear old entries if map gets too large
        if (runSubmissionLimiter.size > MAX_MAP_SIZE) {
            runSubmissionLimiter.clear(); 
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
