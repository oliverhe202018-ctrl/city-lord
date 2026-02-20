'use server';

import { prisma } from '@/lib/prisma';
import { evaluateTasks, RunData, TaskResult } from '@/lib/game/task-engine';
import { revalidatePath } from 'next/cache';
import { RunRecordDTO, ActionResponse } from '@/types/run-sync';

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

        // 1. Prepare Run Data for Evaluation
        const evaluationData: RunData = {
            distance: runData.distance,
            duration: runData.duration,
            claims: runData.polygons,
            timestamp: new Date(runData.timestamp || Date.now()),
        };

        // 2. Evaluate Tasks (In-Memory)
        const potentialResults = evaluateTasks(evaluationData);

        // 3. Transaction: Save Run + Process Rewards
        const result = await prisma.$transaction(async (tx: any) => {
            // A. Create Run Record
            const run = await tx.runs.create({
                data: {
                    user_id: userId,
                    distance: runData.distance,
                    duration: runData.duration,
                    path: runData.path as any,
                    polygons: runData.polygons as any,
                    status: 'completed',
                    created_at: new Date(runData.timestamp || Date.now()),
                    updated_at: new Date(),
                    idempotency_key: runData.idempotencyKey,
                    // Province/City logic could be added here if needed
                },
            });

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
                        total_distance_km: { increment: runData.distance / 1000 },
                        total_area: { increment: runData.polygons.reduce((acc: number, p: any) => acc + (p.area || 0), 0) }
                    }
                });
            } else {
                // Even if no tasks, update stats
                await tx.profiles.update({
                    where: { id: userId },
                    data: {
                        total_distance_km: { increment: runData.distance / 1000 },
                        total_area: { increment: runData.polygons.reduce((acc: number, p: any) => acc + (p.area || 0), 0) }
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
            // Avoid blocking the response for too long, but wait enough to ensure no race condition on immediate fetch?
            // Actually, we should catch errors so run save doesn't fail.
            const eventPayload = {
                type: 'RUN_FINISHED' as const,
                userId: userId,
                timestamp: new Date(),
                data: {
                    distance: runData.distance, // meters
                    duration: runData.duration, // seconds
                    pace: (runData.duration / (runData.distance / 1000)), // s/km
                }
            };
            await TaskService.processEvent(userId, eventPayload);
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
