'use server';

import { prisma } from '@/lib/prisma';
import { evaluateTasks, RunData, TaskResult } from '@/lib/game/task-engine';
import { revalidatePath } from 'next/cache';
import { RunRecordDTO, ActionResponse } from '@/types/run-sync';
import { validateRunAndRebuildTerritories, AntiCheatValidationResult } from '@/lib/anti-cheat/territory-builder';
import { checkRunRateLimit } from '@/lib/anti-cheat/rate-limiter';

export interface SaveRunResult {
    runId?: string;
    newTasks?: TaskResult[];
    totalReward?: { coins: number; xp: number };
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

        // 1. Anti-Cheat Server-Side Validation & Territory Rebuild
        const validation: AntiCheatValidationResult = validateRunAndRebuildTerritories(runData.path as any);

        let finalPolygons = validation.validPolygons;
        let finalArea = validation.totalArea;

        // Settlement Gating
        if (validation.riskLevel === 'MEDIUM') {
            // Neutralize territory acquisition
            finalPolygons = [];
            finalArea = 0;
            console.log(`[saveRunActivity] MEDIUM risk run. Polygons neutralized for user: ${userId}`);
        } else if (validation.riskLevel === 'HIGH') {
            // Hard block: Run marked as rejected, zero rewards, zero territory.
            finalPolygons = [];
            finalArea = 0;
            console.log(`[saveRunActivity] HIGH risk run. Run rejected for user: ${userId}`);
        }

        // 2. Prepare Run Data for Evaluation
        const evaluationData: RunData = {
            distance: validation.serverDistance,
            duration: validation.serverDuration,
            claims: finalPolygons, // Server-calculated claims
            timestamp: new Date(runData.timestamp || Date.now()),
        };

        // 3. Evaluate Tasks (In-Memory)
        const potentialResults = validation.riskLevel === 'HIGH' ? [] : evaluateTasks(evaluationData);

        // 4. Transaction: Save Run + Process Rewards + Audit Logs
        const result = await prisma.$transaction(async (tx: any) => {
            // A. Create Run Record
            const run = await tx.runs.create({
                data: {
                    user_id: userId,
                    distance: evaluationData.distance,
                    duration: evaluationData.duration,
                    path: runData.path as any,
                    polygons: evaluationData.claims as any,
                    status: validation.riskLevel === 'HIGH' ? 'rejected' : 'completed',
                    created_at: new Date(runData.timestamp || Date.now()),
                    updated_at: new Date(),
                    idempotency_key: runData.idempotencyKey,
                    // Anti-Cheat Fields
                    risk_score: validation.riskScore,
                    risk_level: validation.riskLevel,
                    cheat_flags: validation.cheatFlags as any,
                    client_distance: runData.distance,
                },
            });

            // Audit logging for suspicious runs
            if (validation.riskLevel !== 'LOW') {
                await tx.anti_cheat_audit_logs.create({
                    data: {
                        user_id: userId,
                        run_id: run.id,
                        risk_score: validation.riskScore,
                        cheat_flags: validation.cheatFlags as any,
                        raw_payload: runData as any,
                        action_taken: validation.riskLevel === 'HIGH' ? 'rejected' : 'polygons_neutralized',
                    }
                });
            }

            // B. Filter Tasks (Idempotency Check)
            const newTasks: TaskResult[] = [];
            let totalCoins = 0;
            let totalXp = 0;

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
                                reward_xp: 0, // Assuming constant for now, or assume reward is coins
                                completed_at: new Date(),
                            }
                        });

                        newTasks.push(res);
                        totalCoins += res.reward;
                        // totalXp += res.rewardXp; // If we had separate XP in helper
                    }
                }
            }

            // C. Grant Rewards to User
            if (totalCoins > 0 || totalXp > 0) {
                await tx.profiles.update({
                    where: { id: userId },
                    data: {
                        coins: { increment: totalCoins },
                        xp: { increment: totalXp },
                        // Update basic stats too
                        total_distance_km: { increment: evaluationData.distance / 1000 },
                        total_area: { increment: finalArea }
                    }
                });
            } else if (validation.riskLevel !== 'HIGH') {
                // Even if no tasks, update stats if not rejected
                await tx.profiles.update({
                    where: { id: userId },
                    data: {
                        total_distance_km: { increment: evaluationData.distance / 1000 },
                        total_area: { increment: finalArea }
                    }
                });
            }

            return {
                runId: run.id,
                newTasks,
                rewards: { coins: totalCoins, xp: totalXp }
            };
        });

        revalidatePath('/dashboard');
        revalidatePath('/profile/me');

        // Trigger Task Center Event (Async, non-blocking)
        try {
            const { TaskService } = await import('@/lib/services/task');
            // Try tracking the run event
            if (validation.riskLevel !== 'HIGH') {
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
            }
        } catch (taskError) {
            console.error('Task event processing failed', taskError);
        }

        return {
            success: true,
            data: {
                runId: result.runId,
                newTasks: result.newTasks,
                totalReward: result.rewards
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
