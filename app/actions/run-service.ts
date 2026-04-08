'use server';

import { prisma } from '@/lib/prisma';
import { evaluateTasks, RunData, TaskResult } from '@/lib/game/task-engine';
import { revalidatePath, revalidateTag } from 'next/cache';
import { tasks } from "@trigger.dev/sdk/v3";
import { RunRecordDTO, ActionResponse, RunEventLog } from '@/types/run-sync';
import { validateRunAndRebuildTerritories, AntiCheatValidationResult } from '@/lib/anti-cheat/territory-builder';
import { checkRunRateLimit } from '@/lib/anti-cheat/rate-limiter';
import { processTerritorySettlement } from '@/lib/territory/settlement';
import { validateRunData } from '@/lib/validators/run-validator';
import { validateRunLegitimacy } from '@/lib/anti-cheat/mvp-rules';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { cleanAndSplitTrajectory } from '@/lib/gis/geometry-cleaner';
import { isLoopClosed, LOOP_CLOSURE_THRESHOLD_M, extractValidLoops, type Coord } from '@/lib/geometry-utils';
import { isTester } from '@/lib/constants/anti-cheat';

// 用 Ramer-Douglas-Peucker 保留关键几何节点，不破坏环路
function rdpSamplePath(points: any[], maxPoints: number): any[] {
    if (points.length <= maxPoints) return points;
    const line = turf.lineString(points.map((p: any) => [p.lng, p.lat]));
    // 容差从小到大自动收敛，直到点数满足要求
    let tolerance = 0.00001;
    let simplified = points;
    while (simplified.length > maxPoints && tolerance < 0.01) {
        const result = turf.simplify(line, { tolerance, highQuality: false });
        simplified = result.geometry.coordinates.map(([lng, lat]: number[]) => ({ lat, lng }));
        tolerance *= 2;
    }
    return simplified;
}

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
    settlingAsync?: boolean;
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
        const sampledPath = rdpSamplePath(rawPathPoints, MAX_SERVER_PATH_POINTS);

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
                        const intersection = turf.intersect(turf.featureCollection([big.f, candidate.f]));
                        if (intersection) {
                            const overlapRatio = turf.area(intersection) / candidate.area;
                            // 只要重叠面积超过 90%，就认为被大圈吞噬，容忍 GPS 边缘漂移
                            if (overlapRatio > 0.90) {
                                isContained = true;
                                break;
                            }
                        }
                    }
                }
                if (!isContained) survivors.push(candidate);
            }
            return survivors.map(s => s.original);
        }

        const polygonsForSettlement = (isBlockedByAntiCheat || pathValidation.riskLevel === 'MEDIUM') ? [] : deduplicateByContainment(finalPolygons);

        // 5. 直接在内存中累加真实占领的领地面积，拒绝虚高
        let accurateAreaKm2 = 0;
        if (polygonsForSettlement.length > 0) {
            const validPolys: Feature<Polygon>[] = [];
            polygonsForSettlement.forEach((polyPts) => {
                const coords = polyPts.map((p: any) => [p.lng, p.lat] as [number, number]);
                if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
                    coords.push([...coords[0]]);
                }
                if (coords.length >= 4) {
                    validPolys.push(turf.polygon([coords]));
                }
            });

            if (validPolys.length > 0) {
                let merged = validPolys[0] as Feature<Polygon | MultiPolygon>;
                for (let i = 1; i < validPolys.length; i++) {
                    const combined = turf.union(turf.featureCollection([merged, validPolys[i]]));
                    if (combined) {
                        merged = combined as Feature<Polygon | MultiPolygon>;
                    }
                }
                accurateAreaKm2 = turf.area(merged) / 1000000;
            }
        }

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

        // Phase 3: 主事务外部异步结算领地与附属数据更新 (Trigger.dev 核心解耦)
        if (!isBlockedByAntiCheat) {
            const cityId = (runData as any).cityId || 'default_city';
            
            try {
                const triggerPayload = {
                    runId: result.runId,
                    userId,
                    cityId,
                    clubId: runnerClubId,
                    polygons: polygonsForSettlement,
                    distance: evaluationData.distance,
                    duration: evaluationData.duration
                };
                console.log(`[Trigger.dev] Enqueuing 'settle-territories'. polygonCount=${polygonsForSettlement.length}, runId=${result.runId}`);
                console.log(`[Trigger.dev] payload: ${JSON.stringify({ runId: triggerPayload.runId, userId: triggerPayload.userId, cityId: triggerPayload.cityId, polygonCount: triggerPayload.polygons.length })}`);
                const handle = await tasks.trigger("settle-territories", triggerPayload);
                console.log(`[Trigger.dev] ✅ Task enqueued. Handle: ${(handle as any)?.id ?? 'N/A'}`);
            } catch (err: any) {
                console.error(`[Trigger.dev] ❌ FAILED to enqueue 'settle-territories': ${err?.message ?? err}`);
                console.error(`[Trigger.dev] Full error:`, err);
            }
        }

        revalidatePath('/dashboard');
        revalidatePath('/profile/me');
        revalidateTag('territories');
        revalidateTag('city-stats');
        revalidateTag('city-leaderboard');

        return {
            success: true,
            data: {
                runId: result.runId,
                runNumber: result.runNumber,
                newTasks: result.newTasks,
                totalReward: result.rewards,
                damageSummary: [],
                maintenanceSummary: [],
                settledTerritoriesCount: 0,
                isValid: result.isValid,
                antiCheatLog: result.antiCheatLog,
                totalSteps: result.totalSteps,
                settlingAsync: (!result.isFlagged && polygonsForSettlement.length > 0) ? true : undefined
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

export async function getRunSettlementStatus(runId: string): Promise<ActionResponse<{ newTerritories: number; reinforcedTerritories: number; isSettled: boolean } | null>> {
    try {
        if (!runId) throw new Error('Run ID is required');
        const runRec = await prisma.runs.findUnique({
            where: { id: runId },
            select: { new_territories_count: true, reinforced_territories_count: true, status: true, updated_at: true, created_at: true }
        });
        
        if (!runRec) {
            return { success: false, error: 'Run not found' };
        }
        
        // isSettled = true when Trigger.dev background task has finished and written
        // back the 'completed' (or 'flagged') status. This lets the frontend exit
        // the polling loop even when territory capture counts are legitimately 0.
        const isSettled = runRec.status === 'completed' || runRec.status === 'flagged';

        return {
            success: true,
            data: {
                newTerritories: runRec.new_territories_count || 0,
                reinforcedTerritories: runRec.reinforced_territories_count || 0,
                isSettled,
            }
        };
    } catch (error: any) {
        console.error('Failed to fetch run settlement status:', error);
        return { success: false, error: error.message };
    }
}
