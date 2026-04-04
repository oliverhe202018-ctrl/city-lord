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

let _testerWhitelist: Set<string> | null = null;

/**
 * Checks if a user is in the tester whitelist using an O(1) Set lookup.
 * Caches the parsed UUIDs from the TESTER_WHITELIST_UUIDS environment variable.
 * 
 * @param userId - The UUID of the user to check.
 * @returns True if the user is a whitelisted tester.
 */
export function isTester(userId: string): boolean {
    if (!userId) return false;
    if (_testerWhitelist === null) {
        const envStr = process.env.TESTER_WHITELIST_UUIDS || "";
        _testerWhitelist = new Set(
            envStr.split(',').map(id => id.trim()).filter(Boolean)
        );
    }
    return _testerWhitelist.has(userId);
}
