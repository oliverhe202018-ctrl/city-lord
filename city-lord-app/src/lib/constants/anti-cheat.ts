/**
 * Anti-Cheat constants and shared utilities.
 */

// ── 反作弊阈值常量 ──────────────────────────────────

/** 单段最大合法速度 (km/h)，超出视为瞬移/作弊 */
export const ANTI_CHEAT_MAX_SPEED_KMH = 25;

/** 相邻两点最大允许时间间隔 (秒)，超出且位移>500m 视为瞬移 */
export const ANTI_CHEAT_MAX_GAP_SECONDS = 120;

/** Mock 定位点占比阈值 (%)，超出直接判高风险 */
export const ANTI_CHEAT_MOCK_PERCENT_THRESHOLD = 30;

/** 风险等级分数阈值 */
export const ANTI_CHEAT_RISK_THRESHOLDS = {
  MEDIUM: 30,
  HIGH: 60,
} as const;


import { prisma } from '@/lib/prisma';

/**
 * Checks if a user is in the tester whitelist using an O(1) Set lookup.
 * Reads TESTER_WHITELIST_UUIDS from the environment.
 * Also checks the `bypass_anti_cheat` flag in the `profiles` table.
 *
 * @param userId - The UUID of the user to check.
 * @returns True if the user is a whitelisted tester or has bypass enabled.
 */
export async function isTester(userId: string): Promise<boolean> {
    if (!userId) return false;
    const envStr = process.env.TESTER_WHITELIST_UUIDS || "";
    const whitelist = new Set(
        envStr.split(',').map(id => id.trim()).filter(Boolean)
    );
    if (whitelist.has(userId)) return true;

    try {
        const profile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { bypass_anti_cheat: true }
        });
        return profile?.bypass_anti_cheat ?? false;
    } catch (e) {
        console.error("isTester db check failed", e);
        return false;
    }
}
