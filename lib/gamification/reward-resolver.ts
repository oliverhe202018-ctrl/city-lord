
import { prisma } from "@/lib/prisma";
import { RunContext } from "./types";
import { Prisma } from "@prisma/client";

// A simple leveling curve. In a real app, this might be configurable.
const XP_CURVE = (level: number) => Math.floor(100 * Math.pow(level, 1.6));

export interface RewardSummary {
  totalPoints: number;
  totalLevelXp: number;
  maxAreaMultiplier: number;
}

/**
 * Fetches all triggered events and aggregates their reward payloads.
 * @param ctx The run context containing triggered event IDs.
 * @returns A summary of total points, XP, and the highest area multiplier.
 */
export async function resolveEventRewards(
  ctx: RunContext
): Promise<RewardSummary> {
  if (ctx.triggeredEventIds.length === 0) {
    return { totalPoints: 0, totalLevelXp: 0, maxAreaMultiplier: 1 };
  }

  const events = await prisma.random_events.findMany({
    where: {
      id: { in: ctx.triggeredEventIds },
    },
  });

  let totalPoints = 0;
  let totalLevelXp = 0;
  let maxAreaMultiplier = 1;

  for (const event of events) {
    const payload = event.reward_payload as Prisma.JsonObject;
    if (payload) {
      totalPoints += (payload.points as number) || 0;
      totalLevelXp += (payload.levelXp as number) || 0;
      if (payload.areaMultiplier && (payload.areaMultiplier as number) > maxAreaMultiplier) {
        maxAreaMultiplier = payload.areaMultiplier as number;
      }
    }
  }

  return { totalPoints, totalLevelXp, maxAreaMultiplier };
}

/**
 * Applies points and experience to a user's profile in a single transaction.
 * It also handles the logic for leveling up based on the XP curve.
 * @param ctx The run context.
 * @param rewardSummary The aggregated rewards to apply.
 * @returns An object indicating if a level-up occurred and the new level.
 */
export async function applyPointsAndLevel(
  ctx: RunContext,
  rewardSummary: RewardSummary
): Promise<{ leveledUp: boolean; newLevel: number }> {
  return prisma.$transaction(async (tx) => {
    const profile = await tx.profiles.findUniqueOrThrow({
      where: { id: ctx.userId },
    });

    const newCoins = profile.coins + rewardSummary.totalPoints;
    let newXp = profile.xp + rewardSummary.totalLevelXp;

    let currentLevel = profile.level;
    let leveledUp = false;

    // Support multi-level jumps with while loop
    while (newXp >= XP_CURVE(currentLevel)) {
      currentLevel++;
      leveledUp = true;
    }

    await tx.profiles.update({
      where: { id: ctx.userId },
      data: {
        coins: newCoins,
        xp: newXp,
        level: currentLevel,
        max_exp: XP_CURVE(currentLevel),
      },
    });

    return { leveledUp, newLevel: currentLevel };
  });
}
