
import { task } from '@trigger.dev/sdk';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { applyPointsAndLevel, resolveEventRewards } from '@/lib/gamification/reward-resolver';
import { evaluateTaskProgress } from '@/lib/gamification/task-evaluator';
import { RunContext } from '@/lib/gamification/types';

/**
 * This task is a fire-and-forget dispatcher responsible for orchestrating the entire
 * post-run gamification pipeline, from reward calculation to task evaluation.
 */
export const processPostRunRewards = task({
    id: 'process-post-run-rewards',
    input: z.object({
        userId: z.string().uuid(),
        runId: z.string().uuid(),
        distanceKm: z.number().min(0),
        createdTerritories: z.number().min(0),
        triggeredEventIds: z.array(z.string().uuid()),
    }),
    run: async (payload, { logger }) => {
        const { userId, runId, distanceKm, createdTerritories, triggeredEventIds } = payload;

        // 1. Create the central run context
        const context: RunContext = {
            userId,
            runId,
            totalAreaGained: createdTerritories * 100, // Convert territories to m² (1 territory = 100m²)
            totalDistance: distanceKm,
            triggeredEventIds,
        };

        logger.info('Processing post-run rewards', { context });

        try {
            // 2. Resolve rewards from triggered events
            const rewardSummary = await resolveEventRewards(context);
            logger.info('Resolved event rewards', { rewardSummary });

            // 3. Apply points, XP, and handle leveling up
            const { leveledUp, newLevel } = await applyPointsAndLevel(context, rewardSummary);
            logger.info('Applied points and level', { leveledUp, newLevel });

            // 4. Update context with leveling results for other modules to use
            context.leveledUp = leveledUp;
            context.newLevel = newLevel;

            // 5. Evaluate progress for all active tasks
            await evaluateTaskProgress(context);
            logger.info('Evaluated task progress');

            // 6. Update run reward status in database with atomic write-back
            await prisma.runs.update({
                where: { id: runId },
                data: {
                    reward_status: 'COMPLETED',
                    reward_data: {
                        leveledUp,
                        newLevel,
                        rewardSummary
                    },
                    reward_coins: rewardSummary.totalPoints,
                    reward_xp: rewardSummary.totalLevelXp,
                    reward_territories: payload.createdTerritories
                }
            });
            logger.info('Updated run reward status', { 
                runId, 
                leveledUp, 
                newLevel,
                coins: rewardSummary.totalPoints,
                xp: rewardSummary.totalLevelXp,
                territories: payload.createdTerritories
            });

            // 7. (Future) Evaluate badge unlocks
            // await evaluateBadgeUnlocks(context);

            return { success: true, leveledUp, newLevel };
        } catch (error) {
            logger.error('Error in gamification pipeline', { error, userId, runId });
            // Re-throw to let Trigger.dev handle retries
            throw error;
        }
    },
});

