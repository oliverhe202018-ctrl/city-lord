import { prisma } from "@/lib/prisma";
import { RunContext } from "./types";
import { Prisma } from "@prisma/client";
import { grantRewards } from "@/lib/game-logic/reward-service";

export interface RewardSummary {
  totalPoints: number;
  totalLevelXp: number;
  maxAreaMultiplier: number;
  mysteryBonus?: {
    pointsMultiplier: number;
    coinsBonus: number;
  };
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

  let hasMysteryBonus = false;
  let mysteryBonusPointsMultiplier = 1;
  let mysteryCoinsBonus = 0;

  for (const event of events) {
    const payload = event.reward_payload as Prisma.JsonObject;
    if (payload) {
      totalPoints += (payload.points as number) || 0;
      totalLevelXp += (payload.levelXp as number) || 0;
      if (payload.areaMultiplier && (payload.areaMultiplier as number) > maxAreaMultiplier) {
        maxAreaMultiplier = payload.areaMultiplier as number;
      }
      // 处理神秘奖励
      if (payload.mysteryBonus && !hasMysteryBonus) {
        const mystery = payload.mysteryBonus as any;
        mysteryBonusPointsMultiplier = mystery.pointsMultiplier || 1;
        mysteryCoinsBonus = mystery.coinsBonus || 0;
        hasMysteryBonus = true;
      }
    }
  }

  // 应用神秘奖励的倍数
  if (hasMysteryBonus) {
    totalPoints = Math.floor(totalPoints * mysteryBonusPointsMultiplier) + mysteryCoinsBonus;
  }

  return { totalPoints, totalLevelXp, maxAreaMultiplier };
}

/**
 * Applies points and experience to a user's profile.
 * 
 * 升级判定已委托给 lib/game-logic/reward-service.ts 中的 grantRewards，
 * 使用 level-system.ts 的 LEVEL_THRESHOLDS 静态查表逻辑，
 * 确保全站只有唯一一种经验阈值计算标准。
 * 
 * @param ctx The run context.
 * @param rewardSummary The aggregated rewards to apply.
 * @returns An object indicating if a level-up occurred and the new level.
 */
export async function applyPointsAndLevel(
  ctx: RunContext,
  rewardSummary: RewardSummary
): Promise<{ leveledUp: boolean; newLevel: number }> {
  const result = await grantRewards(
    ctx.userId,
    { exp: rewardSummary.totalLevelXp, coins: rewardSummary.totalPoints },
    'POST_RUN_EVENTS',
    ctx.runId
  );

  return { leveledUp: result.levelUp, newLevel: result.newLevel };
}
