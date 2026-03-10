export function getPenaltyConfig() {
    return {
        enabled: process.env.FF_TERRITORY_ABUSE_PENALTY_ENABLED === 'true',
        ratio: parseFloat(process.env.FF_TERRITORY_ABUSE_PENALTY_RATIO || '0.1'),
        zeroRewardEnabled: process.env.FF_TERRITORY_ABUSE_PENALTY_ZERO_REWARD_ENABLED === 'true',
        allowUserIds: (process.env.FF_TERRITORY_ABUSE_PENALTY_ALLOW_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
        allowClubIds: (process.env.FF_TERRITORY_ABUSE_PENALTY_ALLOW_CLUB_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
        lookbackHours: parseInt(process.env.FF_TERRITORY_ABUSE_PENALTY_LOOKBACK_HOURS || '24', 10),
        minFlips: parseInt(process.env.FF_TERRITORY_ABUSE_PENALTY_MIN_FLIPS || '3', 10),
    };
}

export interface PenaltyEvaluationResult {
    appliedRatio: number;
    matchedRule: string;
    reasonWindow: string;
    sourceEventIds: number[]; // Use number or string for BigInt depending on Prisma
    penaltyEnabledSnapshot: boolean;
}

export function evaluatePenalty(
    attackerUserId: string,
    attackerClubId: string | null,
    recentEvents: any[]
): PenaltyEvaluationResult {
    const PENALTY_FLAGS = getPenaltyConfig();
    const defaultResult: PenaltyEvaluationResult = {
        appliedRatio: 1.0,
        matchedRule: 'NORMAL_REWARD',
        reasonWindow: `${PENALTY_FLAGS.lookbackHours}h`,
        sourceEventIds: [],
        penaltyEnabledSnapshot: PENALTY_FLAGS.enabled,
    };

    if (!PENALTY_FLAGS.enabled) {
        return defaultResult;
    }

    // Check whitelists
    const isUserAllowed = PENALTY_FLAGS.allowUserIds.length > 0 && PENALTY_FLAGS.allowUserIds.includes(attackerUserId);
    const isClubAllowed = attackerClubId && PENALTY_FLAGS.allowClubIds.length > 0 && PENALTY_FLAGS.allowClubIds.includes(attackerClubId);

    // If there are allow-lists and neither matched, return default (gray scale)
    if ((PENALTY_FLAGS.allowUserIds.length > 0 || PENALTY_FLAGS.allowClubIds.length > 0) && !isUserAllowed && !isClubAllowed) {
        return defaultResult; // Treated as implicitly disabled for this user/club
    }

    // Evaluate logic using recentEvents of the SAME territory
    if (!recentEvents || recentEvents.length === 0) {
        return defaultResult;
    }

    // Count total flips (claiming events) within the window
    const flipsCount = recentEvents.length;

    if (flipsCount >= PENALTY_FLAGS.minFlips) {
        // Extract past attackers to check A->B->A behaviour
        const pastAttackers = recentEvents.map(e => String(e.user_id));
        const isReturningAttacker = pastAttackers.includes(attackerUserId);

        if (PENALTY_FLAGS.zeroRewardEnabled && isReturningAttacker) {
            // High-frequency mutual farm with A->B->A
            return {
                appliedRatio: 0.0,
                matchedRule: 'A_B_A_ABUSE_0',
                reasonWindow: `${PENALTY_FLAGS.lookbackHours}h`,
                sourceEventIds: recentEvents.map(e => e.id ? Number(e.id) : 0),
                penaltyEnabledSnapshot: PENALTY_FLAGS.enabled
            };
        }

        // Just Frequent Flips
        return {
            appliedRatio: PENALTY_FLAGS.ratio,
            matchedRule: 'FREQUENT_FLIP_10',
            reasonWindow: `${PENALTY_FLAGS.lookbackHours}h`,
            sourceEventIds: recentEvents.map(e => e.id ? Number(e.id) : 0),
            penaltyEnabledSnapshot: PENALTY_FLAGS.enabled
        };
    }

    return defaultResult;
}
