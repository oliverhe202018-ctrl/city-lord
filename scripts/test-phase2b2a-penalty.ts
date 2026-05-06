import { PrismaClient } from '@prisma/client';

export const PENALTY_FLAGS = {
    enabled: process.env.FF_TERRITORY_ABUSE_PENALTY_ENABLED === 'true',
    ratio: parseFloat(process.env.FF_TERRITORY_ABUSE_PENALTY_RATIO || '0.1'),
    zeroRewardEnabled: process.env.FF_TERRITORY_ABUSE_PENALTY_ZERO_REWARD_ENABLED === 'true',
    allowUserIds: (process.env.FF_TERRITORY_ABUSE_PENALTY_ALLOW_USER_IDS || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    allowClubIds: (process.env.FF_TERRITORY_ABUSE_PENALTY_ALLOW_CLUB_IDS || '').split(',').map((s: string) => s.trim()).filter(Boolean),
    lookbackHours: parseInt(process.env.FF_TERRITORY_ABUSE_PENALTY_LOOKBACK_HOURS || '24', 10),
    minFlips: parseInt(process.env.FF_TERRITORY_ABUSE_PENALTY_MIN_FLIPS || '3', 10),
};

export interface PenaltyEvaluationResult {
    appliedRatio: number;
    matchedRule: string;
    reasonWindow: string;
    sourceEventIds: number[];
    penaltyEnabledSnapshot: boolean;
}

export function evaluatePenalty(
    attackerUserId: string,
    attackerClubId: string | null,
    recentEvents: any[]
): PenaltyEvaluationResult {
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

    const isUserAllowed = PENALTY_FLAGS.allowUserIds.length > 0 && PENALTY_FLAGS.allowUserIds.includes(attackerUserId);
    const isClubAllowed = attackerClubId && PENALTY_FLAGS.allowClubIds.length > 0 && PENALTY_FLAGS.allowClubIds.includes(attackerClubId);

    if ((PENALTY_FLAGS.allowUserIds.length > 0 || PENALTY_FLAGS.allowClubIds.length > 0) && !isUserAllowed && !isClubAllowed) {
        return defaultResult;
    }

    if (!recentEvents || recentEvents.length === 0) {
        return defaultResult;
    }

    const flipsCount = recentEvents.length;

    if (flipsCount >= PENALTY_FLAGS.minFlips) {
        const pastAttackers = recentEvents.map(e => String(e.user_id));
        const isReturningAttacker = pastAttackers.includes(attackerUserId);

        if (PENALTY_FLAGS.zeroRewardEnabled && isReturningAttacker) {
            return {
                appliedRatio: 0.0,
                matchedRule: 'A_B_A_ABUSE_0',
                reasonWindow: `${PENALTY_FLAGS.lookbackHours}h`,
                sourceEventIds: recentEvents.map(e => e.id ? Number(e.id) : 0),
                penaltyEnabledSnapshot: PENALTY_FLAGS.enabled
            };
        }

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

const H3_TILE_AREA_KM2 = 0.7373276;
const BASE_SCORE_PER_KM2 = 250;
const HOT_ZONE_CAPTURE_MULTIPLIER = 2.0;
const NORMAL_CAPTURE_MULTIPLIER = 1.0;

const prisma = new PrismaClient();

// A function that replicates the EXACT core transaction of claimTerritory
async function simulateClaimTerritoryCore(cityId: string, cellId: string, userId: string, requestId: string) {
    const startTime = Date.now();

    try {
        const result = await prisma.$transaction(async (tx) => {
            // 1. Lock territory row (FOR UPDATE)
            const existingRows = await tx.$queryRaw<any[]>`SELECT id, owner_id, owner_club_id, owner_faction, health, owner_change_count, last_owner_change_at, neutral_until FROM territories WHERE id = ${cellId} FOR UPDATE`;
            const existing = existingRows.length > 0 ? existingRows[0] : null;

            if (existing?.neutral_until && existing.neutral_until > new Date()) {
                throw new Error('Cooldown');
            }

            const previousOwnerId = existing?.owner_id ?? null;
            const previousClubId = existing?.owner_club_id ?? null;
            const previousFaction = existing?.owner_faction ?? null;

            const profile = await tx.profiles.findUnique({
                where: { id: userId },
                select: { faction: true, club_id: true, id: true }
            });
            if (!profile) throw new Error('Profile not found');

            const windowStart = new Date();
            windowStart.setDate(windowStart.getDate() - 7);

            let isHotZone = false;
            if (existing) {
                const changeCount = existing.owner_change_count ?? 0;
                const lastChange = existing.last_owner_change_at ? new Date(existing.last_owner_change_at) : null;
                isHotZone = changeCount >= 2 && lastChange != null && lastChange >= windowStart;
            }

            const hotZoneMultiple = Math.round(H3_TILE_AREA_KM2 * BASE_SCORE_PER_KM2);
            let earnedScore = Math.round(hotZoneMultiple * (isHotZone ? HOT_ZONE_CAPTURE_MULTIPLIER : NORMAL_CAPTURE_MULTIPLIER));

            let actionState = 'captured';
            let penaltyLog: any = null;

            if (existing && existing.owner_id !== userId && (existing.health ?? 0) <= 0) {
                // PENALTY LOGIC EVALUATION
                const lookbackDate = new Date();
                lookbackDate.setHours(lookbackDate.getHours() - PENALTY_FLAGS.lookbackHours);

                const recentEvents = await tx.$queryRaw<any[]>`
          SELECT id, user_id, new_owner_id, created_at
          FROM territory_events
          WHERE territory_id = ${cellId}
            AND created_at >= ${lookbackDate}
          ORDER BY created_at DESC
        `;

                const penaltyResult = evaluatePenalty(userId, profile.club_id, recentEvents);
                const penaltyRatio = penaltyResult.appliedRatio;

                if (penaltyRatio < 1.0 || penaltyResult.matchedRule !== 'NORMAL_REWARD') {
                    const originalScore = earnedScore;
                    earnedScore = Math.round(earnedScore * penaltyRatio);
                    penaltyLog = {
                        territory_id: cellId,
                        attacker_user_id: userId,
                        attacker_club_id: profile.club_id,
                        defender_user_id: previousOwnerId,
                        matched_rule: penaltyResult.matchedRule,
                        applied_ratio: penaltyRatio,
                        reason_window: penaltyResult.reasonWindow,
                        source_event_ids: penaltyResult.sourceEventIds,
                        penalty_enabled_snapshot: penaltyResult.penaltyEnabledSnapshot,
                        reward_payload_snapshot: { originalScore, finalScore: earnedScore }
                    };
                }
            }

            if (!existing) {
                await tx.territories.create({
                    data: {
                        id: cellId, city_id: cityId, owner_id: userId, owner_club_id: profile.club_id, owner_faction: profile.faction,
                        captured_at: new Date(), health: 1000, level: 1, owner_change_count: 0, last_owner_change_at: new Date(),
                    }
                });
            } else if (existing.owner_id === userId) {
                await tx.territories.update({ where: { id: cellId }, data: { health: 1000, last_maintained_at: new Date() } });
                actionState = 'healed';
            } else if ((existing.health ?? 0) <= 0) {
                await tx.territories.update({
                    where: { id: cellId },
                    data: {
                        owner_id: userId, owner_club_id: profile.club_id, owner_faction: profile.faction,
                        captured_at: new Date(), health: 1000, level: 1, last_maintained_at: new Date(),
                        owner_change_count: { increment: 1 }, last_owner_change_at: new Date(),
                    }
                });
            }

            if (actionState === 'captured') {
                let newEventId: bigint | null = null;
                try {
                    const insertResult = await tx.$queryRaw<any[]>`
            INSERT INTO territory_events (
              territory_id, event_type, user_id, old_owner_id, new_owner_id, 
              old_club_id, new_club_id, old_faction, new_faction, source_request_id, created_at
            ) VALUES (
              ${cellId}, 'CLAIM', CAST(${userId} AS uuid), CAST(${previousOwnerId} AS uuid), CAST(${userId} AS uuid), 
              CAST(${previousClubId} AS uuid), CAST(${profile.club_id} AS uuid), 
              ${previousFaction}, ${profile.faction}, CAST(${requestId} AS uuid), NOW()
            ) RETURNING id
          `;
                    if (insertResult.length > 0) newEventId = insertResult[0].id;
                } catch (eventError: any) {
                    if (eventError.message && eventError.message.includes('idx_territory_events_idempotency')) return { action: 'idempotent_skip', scoreChange: 0, isHotZone: false };
                    throw eventError;
                }

                if (penaltyLog && newEventId !== null) {
                    await tx.$executeRaw`
            INSERT INTO territory_reward_penalties (
              territory_id, claim_event_id, attacker_user_id, attacker_club_id, defender_user_id,
              matched_rule, applied_ratio, reason_window, source_event_ids,
              penalty_enabled_snapshot, reward_payload_snapshot
            ) VALUES (
              ${penaltyLog.territory_id}, ${newEventId}, CAST(${penaltyLog.attacker_user_id} AS uuid), 
              CAST(${penaltyLog.attacker_club_id} AS uuid), 
              CAST(${penaltyLog.defender_user_id} AS uuid),
              ${penaltyLog.matched_rule}, ${penaltyLog.applied_ratio}, ${penaltyLog.reason_window},
              ${JSON.stringify(penaltyLog.source_event_ids)}::jsonb, ${penaltyLog.penalty_enabled_snapshot},
              ${JSON.stringify(penaltyLog.reward_payload_snapshot)}::jsonb
            )
          `;
                }
            }

            return { action: actionState, scoreChange: actionState === 'healed' ? 0 : earnedScore, isHotZone };
        });

        const elapsed = Date.now() - startTime;
        return { success: true, ...result, elapsedMs: elapsed };
    } catch (err: any) {
        return { success: false, error: err.message, elapsedMs: Date.now() - startTime };
    }
}

async function runTests() {
    console.log('--- Phase 2B-2A Gray Test Simulation ---');
    console.log('Environment flags:', PENALTY_FLAGS);

    // Create test cell and clear past events to ensure clean state
    const testCell = 'gray_test_hex_123';
    const cityId = 'shanghai';

    await prisma.$executeRawUnsafe(`DELETE FROM territory_reward_penalties WHERE territory_id = '${testCell}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM territory_events WHERE territory_id = '${testCell}'`);
    await prisma.$executeRawUnsafe(`DELETE FROM territories WHERE id = '${testCell}'`);

    // Create users
    const userA = 'aaa00000-0000-0000-0000-000000000000';
    const userB = 'bbb00000-0000-0000-0000-000000000000';
    const userC = 'ccc00000-0000-0000-0000-000000000000'; // Whitelisted wait user?
    const clubA = 'caaa0000-0000-0000-0000-000000000000';

    await prisma.$executeRawUnsafe(`INSERT INTO clubs (id, name, status) VALUES ('${clubA}', 'Test Club A', 'active') ON CONFLICT DO NOTHING`);
    await prisma.$executeRawUnsafe(`INSERT INTO profiles (id, club_id, faction) VALUES ('${userA}', '${clubA}', 'cyberpunk'), ('${userB}', '${clubA}', 'steampunk'), ('${userC}', null, 'bio') ON CONFLICT DO NOTHING`);

    // Scenario 1: Normal single claim
    console.log('\n--- Scenario 1: Normal Claim (User A) ---');
    let res = await simulateClaimTerritoryCore(cityId, testCell, userA, crypto.randomUUID());
    console.log('Result:', res);
    if (!res.success) {
        require('fs').writeFileSync('error.json', JSON.stringify(res, null, 2));
        throw new Error(res.error);
    }
    let tr = await prisma.$queryRaw<any[]>`SELECT id, owner_id FROM territories WHERE id = ${testCell}`;
    console.log('Territory owner:', tr[0].owner_id);

    // Scenario 2/3: Flip it to User B (Neutral health because we just created it. Need to reset health to 0 to simulate enemy capture)
    await prisma.$executeRawUnsafe(`UPDATE territories SET health = 0 WHERE id = '${testCell}'`);
    console.log('\n--- Scenario 2: Flip 1 (User B captures from A) ---');
    res = await simulateClaimTerritoryCore(cityId, testCell, userB, crypto.randomUUID());
    console.log('Result (Expect full reward because flips < 3):', res);

    await prisma.$executeRawUnsafe(`UPDATE territories SET health = 0 WHERE id = '${testCell}'`);
    console.log('\n--- Scenario 3: Flip 2 (User A captures from B back, making it A->B->A, flip count 2) ---');
    res = await simulateClaimTerritoryCore(cityId, testCell, userA, crypto.randomUUID());
    console.log('Result (Expect full because flips=2):', res);

    await prisma.$executeRawUnsafe(`UPDATE territories SET health = 0 WHERE id = '${testCell}'`);
    console.log('\n--- Scenario 4: Flip 3 (User B captures from A again, flip count 3!) ---');
    res = await simulateClaimTerritoryCore(cityId, testCell, userB, crypto.randomUUID());
    console.log('Result (Expect penalty hit):', res);

    console.log('\nChecking Penalty Table Logs:');
    const logs = await prisma.$queryRaw<any[]>`SELECT * FROM territory_reward_penalties WHERE territory_id = ${testCell} ORDER BY created_at DESC LIMIT 5`;
    console.log(JSON.stringify(logs, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    await prisma.$disconnect();
}

runTests().catch(console.error);
