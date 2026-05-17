
import { task } from '@trigger.dev/sdk';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { applyPointsAndLevel, resolveEventRewards } from '@/lib/gamification/reward-resolver';
import { RunContext } from '@/lib/gamification/types';
import { getTitle } from '@/lib/game-logic/level-system';

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

            // 3.5. Write LEVEL_UP to pending_rewards queue for frontend consumption
            if (leveledUp) {
                const profile = await prisma.profiles.findUnique({
                    where: { id: userId },
                    select: { level: true }
                });
                const oldLevel = profile?.level ? profile.level - 1 : newLevel - 1;
                await prisma.pending_rewards.create({
                    data: {
                        user_id: userId,
                        reward_type: 'LEVEL_UP',
                        payload: {
                            oldLevel,
                            newLevel,
                            newTitle: getTitle(newLevel),
                            source: 'POST_RUN'
                        }
                    }
                });
                logger.info('Wrote LEVEL_UP pending_reward', { userId, oldLevel, newLevel });
            }

            // 4. Update context with leveling results for other modules to use
            context.leveledUp = leveledUp;
            context.newLevel = newLevel;

            // 5. (Task evaluation removed - missions system handles progress)

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

