'use server';

import { prisma } from '@/lib/prisma';
import { evaluateTasks, RunData, TaskResult } from '@/lib/game/task-engine';
import { revalidatePath, revalidateTag } from 'next/cache';
import { RunRecordDTO, ActionResponse, RunEventLog } from '@/types/run-sync';
import { validateRunAndRebuildTerritories, AntiCheatValidationResult } from '@/lib/anti-cheat/territory-builder';
import { checkRunRateLimit } from '@/lib/anti-cheat/rate-limiter';
import { processTerritorySettlement } from '@/lib/territory/settlement';
import { validateRunData } from '@/lib/validators/run-validator';
import { validateRunLegitimacy } from '@/lib/anti-cheat/mvp-rules';
import * as turf from '@turf/turf';
import { Feature, Polygon } from 'geojson';
import { cleanAndSplitTrajectory } from '@/lib/gis/geometry-cleaner';
import { isLoopClosed, LOOP_CLOSURE_THRESHOLD_M, extractValidLoops, type Coord } from '@/lib/geometry-utils';
import { isTester } from '@/lib/constants/anti-cheat';

export interface SaveRunResult {
    runId?: string;
    runNumber?: number;
    newTasks?: TaskResult[];
    totalReward?: { coins: number; xp: number };
    damageSummary?: any[];
    maintenanceSummary?: any[];
    settledTerritoriesCount?: number;
    isValid?: boolean;
    antiCheatLog?: string | null;
    totalSteps?: number;
}

const isRunEventLog = (event: unknown): event is RunEventLog => {
    if (!event || typeof event !== 'object') return false;
    const value = event as Partial<RunEventLog>;
    return Boolean(
        typeof value.eventId === 'string' &&
        (value.eventType === 'CHASE' || value.eventType === 'ENERGY_SURGE') &&
        (value.status === 'SUCCESS' || value.status === 'FAILED') &&
        typeof value.triggeredAt === 'number' &&
        typeof value.resolvedAt === 'number'
    );
};

const getDefaultEventReward = (eventType: RunEventLog['eventType']) => {
    if (eventType === 'CHASE') return { xp: 50, stamina: 0 };
    return { xp: 30, stamina: 5 };
};

const PEDOMETER_STRICT_DISTANCE_METERS = 500;
const PEDOMETER_MIN_STEPS = 100;
const PEDOMETER_MAX_STRIDE_METERS = 1.5;


/**
 * Saves a run and evaluates/grants task rewards atomically.
 * Idempotency is verified via Validated UserTaskLog checks.
 */
export async function saveRunActivity(
    userId: string,
    runData: RunRecordDTO,
    clubId?: string | null
): Promise<ActionResponse<SaveRunResult>> {
    try {
        if (!userId) throw new Error('User ID is required');
        const eventsHistory = Array.isArray(runData.eventsHistory)
            ? runData.eventsHistory.filter(isRunEventLog)
            : [];
        const submittedTotalSteps = Math.max(0, Math.floor(Number(runData.totalSteps ?? runData.steps ?? 0)));
        const runnerClubId = clubId ?? runData.clubId ?? null;

        // Rate Limiting
        const rateLimitResult = checkRunRateLimit(userId);
        if (!rateLimitResult.allowed) {
            console.warn(`[saveRunActivity] Rate limit exceeded for user: ${userId}`);
            return {
                success: false,
                error: `Too many submissions. Please try again in ${rateLimitResult.retryAfter} seconds.`
            };
        }

        // 0. Strong Idempotency Check
        if (runData.idempotencyKey) {
            const existingRun = await prisma.runs.findUnique({
                where: { idempotency_key: runData.idempotencyKey }
            });
            if (existingRun) {
                console.log(`[saveRunActivity] Idempotent replay blocked for key: ${runData.idempotencyKey}`);
                return {
                    success: true,
                    message: "Run already processed securely.",
                    data: { runId: existingRun.id }
                };
            }
        }

        // --- P0 Anti-Cheat MVP Validation ---
        const pathPoints = (runData.path as any[]) || [];
        const legitimacyCheck = validateRunLegitimacy({
            distanceKm: runData.distance / 1000,
            durationSeconds: runData.duration,
            pathPointsCount: pathPoints.length
        });

        // [God Mode] Bypass P0 legit check for white-listed testers
        const isUserTester = isTester(userId);
        if (isUserTester) {
            (legitimacyCheck as any).isValid = true;
            console.log(`[God Mode] P0 Legitimacy check bypassed for tester: ${userId}`);
        }

        if (!legitimacyCheck.isValid) {
            console.warn(`[Anti-Cheat MVP] Run blocked for user ${userId}. Reason: ${legitimacyCheck.reason}`);
            
            // Log the cheat attempt independently of the main transaction
            await prisma.anti_cheat_audit_logs.create({
                data: {
                    user_id: userId,
                    risk_score: 100, // Blocking offense
                    cheat_flags: { mvp_reason: legitimacyCheck.reason },
                    raw_payload: runData as any,
                    action_taken: 'BLOCKED_SETTLEMENT'
                }
            });

            return {
                success: false,
                error: "检测到数据异常，可能使用了交通工具，本次跑步无法作为有效占领记录。"
            };
        }
        // ------------------------------------

        // 1. Metadata-based Anti-Cheat check (Speed, Stride, Teleportation)
        const metadataValidation = validateRunData({
            distanceMeters: runData.distance,
            durationSeconds: runData.duration,
            steps: submittedTotalSteps
        });

        // 2. Server-Side Path Analysis & Territory Rebuild (Existing Logic)
        const pathValidation: AntiCheatValidationResult = validateRunAndRebuildTerritories(runData.path as any);

        let pedometerAntiCheatLog: string | null = null;
        if (runData.distance > PEDOMETER_STRICT_DISTANCE_METERS) {
            if (submittedTotalSteps < PEDOMETER_MIN_STEPS) {
                pedometerAntiCheatLog = 'STEP_TOO_LOW';
            } else {
                const strideLength = runData.distance / submittedTotalSteps;
                if (strideLength > PEDOMETER_MAX_STRIDE_METERS) {
                    pedometerAntiCheatLog = 'STRIDE_TOO_LONG';
                }
            }
        }

        // Combined risk assessment
        let isFlagged = metadataValidation.isFlagged || pathValidation.riskLevel === 'HIGH';
        let isPedometerInvalid = pedometerAntiCheatLog !== null;

        if (isUserTester) {
            isFlagged = false;
            isPedometerInvalid = false;
            pedometerAntiCheatLog = null;
        }

        const isBlockedByAntiCheat = isFlagged || isPedometerInvalid;
        const flagReason = metadataValidation.flagReason || (pathValidation.riskLevel === 'HIGH' ? 'PATH_ANALYSIS_FAILED' : undefined);

        // 2. 轨迹采样降维 (防 O(N²) 爆算)
        const MAX_SERVER_PATH_POINTS = 600;
        const rawPathPoints = (runData.path as any[]) || [];
        const sampledPath = rawPathPoints.length > MAX_SERVER_PATH_POINTS
            ? rawPathPoints.filter((_: any, i: number) => i % Math.ceil(rawPathPoints.length / MAX_SERVER_PATH_POINTS) === 0)
            : rawPathPoints;

        // 3. 提取闭环
        const extractedLoops = extractValidLoops(sampledPath, LOOP_CLOSURE_THRESHOLD_M);
        let finalPolygons: Coord[][] = extractedLoops;

        // Settlement Gating
        if (isBlockedByAntiCheat) {
            finalPolygons = [];
            console.warn(`[Anti-Cheat] Settlement blocked for user ${userId}. Reason: ${flagReason ?? pedometerAntiCheatLog}`);
        } else if (pathValidation.riskLevel === 'MEDIUM') {
            finalPolygons = [];
            console.log(`[saveRunActivity] MEDIUM risk run. Polygons neutralized for user: ${userId}`);
        }

        // 4. 大圈吞噬小圈核心算法 (BBox 加速)
        function deduplicateByContainment(polygons: any[]): any[] {
            if (polygons.length <= 1) return polygons;

            const withData = polygons.map(polyPts => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
                if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                    coords.push([...coords[0]]);
                }
                const f = turf.polygon([coords]);
                return { original: polyPts, f, area: turf.area(f), bbox: turf.bbox(f) };
            });

            // 优化1：过滤 < 50 平米的 GPS 漂移噪点，并按面积降序排列
            const sorted = withData.filter(x => x.area >= 50).sort((a, b) => b.area - a.area);

            const survivors: typeof sorted = [];
            for (const candidate of sorted) {
                let isContained = false;
                for (const big of survivors) {
                    // 优化2：BBox (包围盒) 快速拒绝。不相交的包围盒绝对不可能包含
                    if (
                        candidate.bbox[0] >= big.bbox[0] && candidate.bbox[1] >= big.bbox[1] &&
                        candidate.bbox[2] <= big.bbox[2] && candidate.bbox[3] <= big.bbox[3]
                    ) {
                        // 优化3：只对极大概率包含的图形进行昂贵的 Turf 运算
                        if (turf.booleanContains(big.f, candidate.f)) {
                            isContained = true;
                            break;
                        }
                    }
                }
                if (!isContained) survivors.push(candidate);
            }
            return survivors.map(s => s.original);
        }

        const polygonsForSettlement = (isBlockedByAntiCheat || pathValidation.riskLevel === 'MEDIUM') ? [] : deduplicateByContainment(finalPolygons);

        // 5. 直接在内存中累加真实占领的领地面积，拒绝虚高
        const accurateAreaKm2 = polygonsForSettlement.reduce((sum, polyPts) => {
            const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
            if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                coords.push([...coords[0]]);
            }
            return sum + (turf.area(turf.polygon([coords])) / 1000000); // 平方米转平方公里
        }, 0);

        // 3. Prepare Run Data for Evaluation
        const evaluationData: RunData = {
            distance: pathValidation.serverDistance,
            duration: pathValidation.serverDuration,
            claims: finalPolygons, // Server-calculated claims
            timestamp: new Date(runData.timestamp || Date.now()),
        };

        // 4. Evaluate Tasks (In-Memory)
        // If flagged, we skip rewards by setting results to empty
        const potentialResults = (isBlockedByAntiCheat || pathValidation.riskLevel === 'HIGH') ? [] : evaluateTasks(evaluationData);

        // 5. Transaction: Save Run + Process Rewards + Audit Logs
        const result = await prisma.$transaction(async (tx: any) => {
            // A. Create Run Record (Always saved, even if flagged)
            const run = await tx.runs.create({
                data: {
                    user_id: userId,
                    distance: evaluationData.distance,
                    duration: evaluationData.duration,
                    path: runData.path as any,
                    polygons: evaluationData.claims as any,
                    status: isBlockedByAntiCheat ? 'flagged' : 'completed',
                    created_at: new Date(runData.timestamp || Date.now()),
                    updated_at: new Date(),
                    idempotency_key: runData.idempotencyKey,
                    // Anti-Cheat Fields
                    risk_score: isUserTester ? 0 : pathValidation.riskScore,
                    risk_level: isUserTester ? 'LOW' : pathValidation.riskLevel,
                    cheat_flags: {
                        ...(pathValidation.cheatFlags as any),
                        ...(isUserTester ? { tester_bypass: true } : {})
                    } as any,
                    client_distance: runData.distance,
                    // New Validator Fields
                    is_flagged: isUserTester ? false : isFlagged,
                    flag_reason: isUserTester ? null : flagReason,
                    eventsLog: eventsHistory as any,
                    totalSteps: submittedTotalSteps,
                    isValid: isUserTester ? true : !isPedometerInvalid,
                    antiCheatLog: isUserTester ? null : pedometerAntiCheatLog,
                },
            });

            // Audit logging for suspicious runs
            if (isBlockedByAntiCheat || pathValidation.riskLevel !== 'LOW') {
                await tx.anti_cheat_audit_logs.create({
                    data: {
                        user_id: userId,
                        run_id: run.id,
                        risk_score: isPedometerInvalid ? Math.max(pathValidation.riskScore, 90) : pathValidation.riskScore,
                        cheat_flags: {
                            ...(pathValidation.cheatFlags as any),
                            pedometer_reason: pedometerAntiCheatLog
                        } as any,
                        raw_payload: runData as any,
                        action_taken: isPedometerInvalid ? 'pedometer_blocked' : (isFlagged ? 'shadowban' : 'polygons_neutralized'),
                    }
                });
            }

            if (isBlockedByAntiCheat) {
                return {
                    runId: run.id,
                    runNumber: 0, // Not precisely needed for shadowban
                    newTasks: [],
                    rewards: { coins: 0, xp: 0 },
                    isValid: !isPedometerInvalid,
                    antiCheatLog: pedometerAntiCheatLog,
                    totalSteps: submittedTotalSteps,
                    isFlagged: true
                };
            }

            // B. Filter Tasks (Idempotency Check)
            const newTasks: TaskResult[] = [];
            let totalCoins = 0;
            let totalXp = 0;
            
            // ... (Rest of existing reward and settlement logic)

            if (potentialResults.length > 0) {
                // Find existing logs for these specific tasks & periods to prevent duplicates
                // We construct an OR query for all potential completions
                const checks = potentialResults.map(r => ({
                    user_id: userId,
                    task_id: r.taskId,
                    period_key: r.periodKey
                }));

                const existingLogs = await tx.user_task_logs.findMany({
                    where: {
                        OR: checks
                    },
                    select: {
                        task_id: true,
                        period_key: true
                    }
                });

                const existingSet = new Set(
                    existingLogs.map((l: any) => `${l.task_id}-${l.period_key}`)
                );

                // Process only NEW completions
                for (const res of potentialResults) {
                    const key = `${res.taskId}-${res.periodKey}`;
                    if (!existingSet.has(key)) {
                        // Valid new completion
                        await tx.user_task_logs.create({
                            data: {
                                user_id: userId,
                                run_id: run.id,
                                task_id: res.taskId,
                                type: res.type,
                                period_key: res.periodKey,
                                reward_coins: res.reward,
                                reward_xp: 0, // TODO: 当 XP 奖励系统上线后，此处需接入真实的 XP 计算逻辑
                                completed_at: new Date(),
                            }
                        });

                        newTasks.push(res);
                        totalCoins += res.reward;
                        // totalXp += res.rewardXp; // If we had separate XP in helper
                    }
                }
            }

            const successfulEvents = eventsHistory.filter(event => event.status === 'SUCCESS');
            const failedEvents = eventsHistory.filter(event => event.status === 'FAILED');
            const hasFailureEvent = failedEvents.length > 0;
            const penaltyMultiplier = hasFailureEvent
                ? Math.min(...failedEvents.map(event => event.penaltyMultiplier ?? 0.5))
                : 1;

            const eventReward = successfulEvents.reduce(
                (acc, event) => {
                    const defaults = getDefaultEventReward(event.eventType);
                    acc.xp += event.reward?.xp ?? defaults.xp;
                    acc.stamina += event.reward?.stamina ?? defaults.stamina;
                    return acc;
                },
                { xp: 0, stamina: 0 }
            );

            totalCoins = Math.floor(totalCoins * penaltyMultiplier);
            totalXp = Math.floor(totalXp * penaltyMultiplier) + eventReward.xp;

            // C. Get Run Number
            const runNumber = await tx.runs.count({
                where: { user_id: userId }
            });

            // D. Update City Progress — accurateAreaKm2 pre-computed outside tx
            if (!isFlagged) {
                const cityId = (runData as any).cityId || "default_city";

                await tx.user_city_progress.upsert({
                    where: {
                        user_id_city_id: {
                            user_id: userId,
                            city_id: cityId
                        }
                    },
                    update: {
                        area_controlled: { increment: accurateAreaKm2 },
                        last_active_at: new Date()
                    },
                    create: {
                        user_id: userId,
                        city_id: cityId,
                        area_controlled: accurateAreaKm2,
                        tiles_captured: 0, // 数量会在微事务中补充
                        last_active_at: new Date(),
                        joined_at: new Date()
                    }
                });

                // Update Profile Stats
                const updatedProfile = await tx.profiles.update({
                    where: { id: userId },
                    data: {
                        coins: { increment: totalCoins },
                        xp: { increment: totalXp },
                        stamina: { increment: eventReward.stamina },
                        total_distance_km: { increment: evaluationData.distance / 1000 },
                        total_area: { increment: accurateAreaKm2 },
                        total_runs_count: { increment: 1 },
                        updated_at: new Date()
                    }
                });

                return {
                    runId: run.id,
                    runNumber: updatedProfile.total_runs_count,
                    newTasks,
                    rewards: { coins: totalCoins, xp: totalXp },
                    isValid: true,
                    antiCheatLog: null,
                    totalSteps: submittedTotalSteps,
                    isFlagged: false
                };
            }

            return {
                runId: run.id,
                runNumber: 0,
                newTasks,
                rewards: { coins: totalCoins, xp: totalXp },
                isValid: true,
                antiCheatLog: null,
                totalSteps: submittedTotalSteps,
                isFlagged: true
            };
        }, { timeout: 30000, maxWait: 10000 });

        // Phase 3: 主事务外部异步结算领地 (核心解耦)
        let settledTerritoriesCount = 0;
        const allDamageDetails: any[] = [];
        const allMaintenanceDetails: any[] = [];

        if (!result.isFlagged) {
            for (const polyPoints of polygonsForSettlement) {
                const loopCheck = isLoopClosed(
                    polyPoints.map((pt: any, i: number) => ({ ...pt, timestamp: pt.timestamp ?? i })),
                    LOOP_CLOSURE_THRESHOLD_M
                );
                if (!loopCheck.isClosed) continue;

                const coords = polyPoints.map((p: any) => [p.lng, p.lat] as [number, number]);
                if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                    coords.push([...coords[0]]);
                }

                try {
                    const polyFeature = turf.polygon([coords]);
                    // 在外部预处理几何
                    const cleaned = cleanAndSplitTrajectory(coords);
                    const cityId = (runData as any).cityId || 'default_city';

                    // 独立调用，不传入 db，让 settlement 自己开微事务
                    const settlement = await processTerritorySettlement({
                        runId: result.runId,
                        userId,
                        cityId,
                        clubId: runnerClubId,
                        pathGeoJSON: polyFeature as any,
                        preProcessedPolygons: cleaned as any
                    });

                    if (settlement.success) {
                        settledTerritoriesCount += settlement.createdTerritories;
                        allDamageDetails.push(...(settlement.damageDetails ?? []));
                        allMaintenanceDetails.push(...(settlement.maintenanceDetails ?? []));
                    }
                } catch (e) {
                    console.error('[Settlement] Failed loop settlement:', e);
                }
            }

            // 补充更新占领的小图块数量
            if (settledTerritoriesCount > 0) {
                const cityId = (runData as any).cityId || 'default_city';
                await prisma.user_city_progress.update({
                    where: { user_id_city_id: { user_id: userId, city_id: cityId } },
                    data: { tiles_captured: { increment: settledTerritoriesCount } }
                }).catch(e => console.error('[Settlement] Failed to update tiles_captured', e));
            }
        }


        revalidatePath('/dashboard');
        revalidatePath('/profile/me');
        revalidateTag('territories');
        revalidateTag('city-stats');
        revalidateTag('city-leaderboard');

        // Trigger Task Center Event (Awaiting to ensure consistency before response)
        try {
            const { TaskService } = await import('@/lib/services/task');
            if (!isBlockedByAntiCheat) {
                const eventPayload = {
                    type: 'RUN_FINISHED' as const,
                    userId: userId,
                    timestamp: new Date(),
                    data: {
                        distance: evaluationData.distance, // meters
                        duration: evaluationData.duration, // seconds
                        pace: (evaluationData.duration / (evaluationData.distance / 1000)), // s/km
                    }
                };
                await TaskService.processEvent(userId, eventPayload);
                console.log(`[Task] Event processed synchronously for user: ${userId}`);
            }
        } catch (taskError) {
            console.error('Task event processing failed', taskError);
        }

        // [Challenge System] Update 1v1 challenge progress (fire-and-forget)
        if (!isBlockedByAntiCheat) {
            try {
                const { updateChallengeProgress } = await import('@/app/actions/challenge-service');
                const paceSecondsPerKm = evaluationData.distance > 0
                    ? evaluationData.duration / (evaluationData.distance / 1000)
                    : 0;
                await updateChallengeProgress(userId, {
                    distance_meters: evaluationData.distance,
                    hexes_claimed: settledTerritoriesCount,
                    pace_seconds_per_km: paceSecondsPerKm,
                });
                console.log(`[Challenge] Progress updated for user: ${userId}`);
            } catch (challengeError) {
                console.error('[Challenge] Progress update failed (non-blocking):', challengeError);
            }
        }

        return {
            success: true,
            data: {
                runId: result.runId,
                runNumber: result.runNumber,
                newTasks: result.newTasks,
                totalReward: result.rewards,
                damageSummary: allDamageDetails,
                maintenanceSummary: allMaintenanceDetails,
                settledTerritoriesCount: settledTerritoriesCount,
                isValid: result.isValid,
                antiCheatLog: result.antiCheatLog,
                totalSteps: result.totalSteps
            }
        };

    } catch (error: any) {
        console.error('Failed to save run:', error);
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Updates the AI summary for a specific run record.
 */
export async function updateRunSummary(runId: string, summary: string): Promise<ActionResponse<void>> {
    try {
        if (!runId || !summary) throw new Error('Run ID and summary are required');
        
        await prisma.runs.update({
            where: { id: runId },
            data: { aiSummary: summary }
        });

        console.log(`[RunService] AI Summary updated for run: ${runId}`);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update run summary:', error);
        return { success: false, error: error.message };
    }
}
