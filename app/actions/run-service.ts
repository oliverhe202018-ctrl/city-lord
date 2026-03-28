'use server';

import { prisma } from '@/lib/prisma';
import { evaluateTasks, RunData, TaskResult } from '@/lib/game/task-engine';
import { revalidatePath, revalidateTag } from 'next/cache';
import { RunRecordDTO, ActionResponse } from '@/types/run-sync';
import { validateRunAndRebuildTerritories, AntiCheatValidationResult } from '@/lib/anti-cheat/territory-builder';
import { checkRunRateLimit } from '@/lib/anti-cheat/rate-limiter';
import { processTerritorySettlement } from '@/lib/territory/settlement';
import { validateRunData } from '@/lib/validators/run-validator';
import { validateRunLegitimacy } from '@/lib/anti-cheat/mvp-rules';
import * as turf from '@turf/turf';

export interface SaveRunResult {
    runId?: string;
    runNumber?: number;
    newTasks?: TaskResult[];
    totalReward?: { coins: number; xp: number };
    damageSummary?: any[];
    maintenanceSummary?: any[];
    settledTerritoriesCount?: number;
}


/**
 * Saves a run and evaluates/grants task rewards atomically.
 * Idempotency is verified via Validated UserTaskLog checks.
 */
export async function saveRunActivity(
    userId: string,
    runData: RunRecordDTO
): Promise<ActionResponse<SaveRunResult>> {
    try {
        if (!userId) throw new Error('User ID is required');

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
            steps: runData.steps || 0
        });

        // 2. Server-Side Path Analysis & Territory Rebuild (Existing Logic)
        const pathValidation: AntiCheatValidationResult = validateRunAndRebuildTerritories(runData.path as any);

        // Combined risk assessment
        const isFlagged = metadataValidation.isFlagged || pathValidation.riskLevel === 'HIGH';
        const flagReason = metadataValidation.flagReason || (pathValidation.riskLevel === 'HIGH' ? 'PATH_ANALYSIS_FAILED' : undefined);

        let finalPolygons = pathValidation.validPolygons;
        let finalArea = pathValidation.totalArea;

        // Settlement Gating
        if (isFlagged) {
            // Shadowban: Force zero territory and rewards later
            finalPolygons = [];
            finalArea = 0;
            console.warn(`[Anti-Cheat] Shadowban triggered for user ${userId}. Reason: ${flagReason}`);
        } else if (pathValidation.riskLevel === 'MEDIUM') {
            finalPolygons = [];
            finalArea = 0;
            console.log(`[saveRunActivity] MEDIUM risk run. Polygons neutralized for user: ${userId}`);
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
        const potentialResults = (isFlagged || pathValidation.riskLevel === 'HIGH') ? [] : evaluateTasks(evaluationData);

        // 5. Transaction: Save Run + Process Rewards + Audit Logs
        const result = await prisma.$transaction(async (tx: any) => {
            // A. Create Run Record (Always saved, even if flagged)
            const run = await tx.run.create({
                data: {
                    user_id: userId,
                    distance: evaluationData.distance,
                    duration: evaluationData.duration,
                    path: runData.path as any,
                    polygons: evaluationData.claims as any,
                    status: isFlagged ? 'flagged' : 'completed',
                    created_at: new Date(runData.timestamp || Date.now()),
                    updated_at: new Date(),
                    idempotency_key: runData.idempotencyKey,
                    // Anti-Cheat Fields
                    risk_score: pathValidation.riskScore,
                    risk_level: pathValidation.riskLevel,
                    cheat_flags: pathValidation.cheatFlags as any,
                    client_distance: runData.distance,
                    // New Validator Fields
                    is_flagged: isFlagged,
                    flag_reason: flagReason,
                },
            });

            // Audit logging for suspicious runs
            if (isFlagged || pathValidation.riskLevel !== 'LOW') {
                await tx.antiCheatAuditLog.create({
                    data: {
                        user_id: userId,
                        run_id: run.id,
                        risk_score: pathValidation.riskScore,
                        cheat_flags: pathValidation.cheatFlags as any,
                        raw_payload: runData as any,
                        action_taken: isFlagged ? 'shadowban' : 'polygons_neutralized',
                    }
                });
            }

            // Shadowban intercept: If flagged, return success early to client without processing rewards
            if (isFlagged) {
                return {
                    runId: run.id,
                    runNumber: 0, // Not precisely needed for shadowban
                    newTasks: [],
                    rewards: { coins: 0, xp: 0 },
                    damageSummary: [],
                    maintenanceSummary: []
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

                const existingLogs = await tx.userTaskLog.findMany({
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
                        await tx.userTaskLog.create({
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

            // C. Territory Settlement (Phase 2 & 4)
            let settledTerritoriesCount = 0;
            const allDamageDetails: any[] = [];
            const allMaintenanceDetails: any[] = [];
            if (finalPolygons.length > 0 && !isFlagged && pathValidation.riskLevel === 'LOW') {
                for (const polyPoints of finalPolygons) {
                    const coords = polyPoints.map(p => [p.lng, p.lat]);
                    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
                        coords.push(coords[0]);
                    }
                    const polyFeature = turf.polygon([coords]);
                    
                    // TODO: Extract actual cityId from points if needed, 
                    // for now use the one from runData or fallback
                    const cityId = (runData as any).cityId || "default_city";

                    const settlement = await processTerritorySettlement({
                        runId: run.id,
                        userId: userId,
                        cityId: cityId,
                        pathGeoJSON: polyFeature,
                        db: tx
                    });
                    if (settlement.success) {
                        settledTerritoriesCount += settlement.createdTerritories;
                        if (settlement.damageDetails) {
                            allDamageDetails.push(...settlement.damageDetails);
                        }
                        if (settlement.maintenanceDetails) {
                            allMaintenanceDetails.push(...settlement.maintenanceDetails);
                        }
                    }
                }
            }

            // D. Get Run Number (Phase 3)
            const runNumber = await tx.run.count({
                where: { user_id: userId }
            });

            // E. Update City Progress (Phase 2)
            if (!isFlagged) {
                const cityId = (runData as any).cityId || "default_city";
                
                // Calculate accurate area in km2 for both progress and profile
                const { MapService } = await import('@/lib/services/mapService');
                const accurateAreaKm2 = await MapService.calculateAreaKm2(JSON.stringify(runData.path)); 

                await tx.userCityProgress.upsert({
                    where: {
                        user_id_city_id: {
                            user_id: userId,
                            city_id: cityId
                        }
                    },
                    update: {
                        area_controlled: { increment: accurateAreaKm2 },
                        tiles_captured: { increment: settledTerritoriesCount },
                        last_active_at: new Date()
                    },
                    create: {
                        user_id: userId,
                        city_id: cityId,
                        area_controlled: accurateAreaKm2,
                        tiles_captured: settledTerritoriesCount,
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
                    damageSummary: allDamageDetails,
                    maintenanceSummary: allMaintenanceDetails,
                    settledTerritoriesCount: settledTerritoriesCount,
                };
            }

            return {
                runId: run.id,
                runNumber: 0,
                newTasks,
                rewards: { coins: totalCoins, xp: totalXp },
                damageSummary: allDamageDetails,
                maintenanceSummary: allMaintenanceDetails,
                settledTerritoriesCount: settledTerritoriesCount,
            };
        });


        revalidatePath('/dashboard');
        revalidatePath('/profile/me');
        revalidateTag('territories');
        revalidateTag('city-stats');
        revalidateTag('city-leaderboard');

        // Trigger Task Center Event (Awaiting to ensure consistency before response)
        try {
            const { TaskService } = await import('@/lib/services/task');
            if (!isFlagged) {
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
        if (!isFlagged) {
            try {
                const { updateChallengeProgress } = await import('@/app/actions/challenge-service');
                const paceSecondsPerKm = evaluationData.distance > 0
                    ? evaluationData.duration / (evaluationData.distance / 1000)
                    : 0;
                await updateChallengeProgress(userId, {
                    distance_meters: evaluationData.distance,
                    hexes_claimed: result.settledTerritoriesCount ?? 0,
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
                damageSummary: result.damageSummary,
                maintenanceSummary: result.maintenanceSummary
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
