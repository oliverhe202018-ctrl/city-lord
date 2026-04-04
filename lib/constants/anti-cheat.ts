/**
 * Anti-Cheat Thresholds & Settings
 * Configurable via server/environment.
 */

// Max allowed speed in km/h for a single segment
export const ANTI_CHEAT_MAX_SPEED_KMH = Number(process.env.ANTI_CHEAT_MAX_SPEED_KMH || 35);

// The maximum acceptable distance gap in seconds (teleportation check)
export const ANTI_CHEAT_MAX_GAP_SECONDS = Number(process.env.ANTI_CHEAT_MAX_GAP_SECONDS || 60);

// Percentage threshold for mock location points (0-100)
// If more than this % of points have isMock = true, it is heavily penalized.
export const ANTI_CHEAT_MOCK_PERCENT_THRESHOLD = Number(process.env.ANTI_CHEAT_MOCK_PERCENT_THRESHOLD || 5);

// Allowed static movement standard deviation (in meters)
export const ANTI_CHEAT_STATIC_MOVEMENT_RADIUS = Number(process.env.ANTI_CHEAT_STATIC_MOVEMENT_RADIUS || 5);

export const ANTI_CHEAT_RISK_THRESHOLDS = {
    MEDIUM: 31,
    HIGH: 71
};

let _testerWhitelist: Set<string> | null = null;

export function isTester(userId: string): boolean {
    if (!userId) return false;
    if (_testerWhitelist === null) {
        const envStr = process.env.TESTER_WHITELIST_UUIDS || "";
        _testerWhitelist = new Set(envStr.split(',').map(id => id.trim()).filter(Boolean));
    }
    return _testerWhitelist.has(userId);
}

