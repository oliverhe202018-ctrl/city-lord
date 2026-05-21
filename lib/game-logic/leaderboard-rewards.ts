/**
 * leaderboard-rewards.ts
 * 
 * 排行榜结算奖励分发逻辑
 * - 按阵营/俱乐部排名计算奖励
 * - 向胜利阵营玩家发放金币/XP加成
 * - 记录结算历史防止重复发放
 */

import { prisma } from '@/lib/prisma'

export interface LeaderboardRewardConfig {
  // 排名奖励 (金币)
  rankCoins: {
    first: number
    second: number
    third: number
    topTen: number
    participation: number
  }
  // XP 加成倍率
  xpMultiplier: {
    first: number
    second: number
    third: number
    topTen: number
    participation: number
  }
}

export const DEFAULT_REWARD_CONFIG: LeaderboardRewardConfig = {
  rankCoins: {
    first: 500,
    second: 300,
    third: 150,
    topTen: 50,
    participation: 10,
  },
  xpMultiplier: {
    first: 1.5,
    second: 1.3,
    third: 1.2,
    topTen: 1.1,
    participation: 1.0,
  },
}

/**
 * 计算并分发排行榜奖励
 * @param settlementDate 结算日期（用于去重）
 * @param config 奖励配置（可选，使用默认值）
 */
export async function distributeLeaderboardRewards(
  settlementDate: Date = new Date(),
  config: LeaderboardRewardConfig = DEFAULT_REWARD_CONFIG,
): Promise<{
  success: boolean
  totalRewarded: number
  details: Array<{ userId: string; coins: number; xpMultiplier: number }>
  error?: string
}> {
  try {
    const dateKey = settlementDate.toISOString().split('T')[0]

    // Check if already settled for this date
    const existingSettlement = await prisma.leaderboard_settlements.findFirst({
      where: { settlement_date: settlementDate },
    })

    if (existingSettlement) {
      console.log(`[LeaderboardRewards] Already settled for ${dateKey}, skipping`)
      return {
        success: false,
        totalRewarded: 0,
        details: [],
        error: 'ALREADY_SETTLED',
      }
    }

    // Get faction rankings by total area/score
    const factionRankings = await prisma.$queryRaw<
      Array<{ faction: string; total_score: number; member_count: number }>
    >`
      SELECT 
        p.faction,
        COALESCE(SUM(t.health), 0) as total_score,
        COUNT(DISTINCT p.id) as member_count
      FROM profiles p
      LEFT JOIN territories t ON t.owner_id = p.id AND t.status = 'ACTIVE'
      WHERE p.faction IS NOT NULL
      GROUP BY p.faction
      ORDER BY total_score DESC
    `

    if (factionRankings.length === 0) {
      console.log('[LeaderboardRewards] No factions found, skipping')
      return { success: true, totalRewarded: 0, details: [] }
    }

    // Build rank map: faction -> rank (1-based)
    const factionRankMap = new Map<string, number>()
    factionRankings.forEach((f, idx) => {
      factionRankMap.set(f.faction, idx + 1)
    })

    // Get all users with factions
    const usersWithFactions = await prisma.profiles.findMany({
      where: { faction: { not: null } },
      select: { id: true, faction: true },
    })

    const details: Array<{ userId: string; coins: number; xpMultiplier: number }> = []
    let totalRewarded = 0

    // Process rewards in batches
    const BATCH_SIZE = 100
    for (let i = 0; i < usersWithFactions.length; i += BATCH_SIZE) {
      const batch = usersWithFactions.slice(i, i + BATCH_SIZE)

      await prisma.$transaction(async (tx) => {
        for (const user of batch) {
          const rank = factionRankMap.get(user.faction!) ?? 999
          const { coins, xpMultiplier } = getRewardForRank(rank, config)

          // Apply coins reward
          if (coins > 0) {
            await tx.profiles.update({
              where: { id: user.id },
              data: {
                coins: { increment: coins },
                updated_at: new Date(),
              },
            })
          }

          // Store XP multiplier as a temporary buff (applied on next run)
          // This is stored in a separate table for tracking
          await tx.user_buffs.create({
            data: {
              user_id: user.id,
              buff_type: 'XP_MULTIPLIER',
              buff_value: xpMultiplier,
              expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
              source: `leaderboard_${dateKey}`,
            },
          })

          details.push({ userId: user.id, coins, xpMultiplier })
          totalRewarded += coins
        }
      })
    }

    // Record settlement
    await prisma.leaderboard_settlements.create({
      data: {
        settlement_date: settlementDate,
        faction_rankings: factionRankings as any,
        total_rewards_distributed: totalRewarded,
        total_users_rewarded: usersWithFactions.length,
      },
    })

    console.log(
      `[LeaderboardRewards] ✅ Settled ${dateKey}: ${usersWithFactions.length} users rewarded, ${totalRewarded} coins distributed`,
    )

    return { success: true, totalRewarded, details }
  } catch (error) {
    console.error('[LeaderboardRewards] distributeLeaderboardRewards failed:', error)
    return {
      success: false,
      totalRewarded: 0,
      details: [],
      error: error instanceof Error ? error.message : 'INTERNAL_ERROR',
    }
  }
}

/**
 * Get reward for a specific rank
 */
function getRewardForRank(
  rank: number,
  config: LeaderboardRewardConfig,
): { coins: number; xpMultiplier: number } {
  if (rank === 1) {
    return { coins: config.rankCoins.first, xpMultiplier: config.xpMultiplier.first }
  } else if (rank === 2) {
    return { coins: config.rankCoins.second, xpMultiplier: config.xpMultiplier.second }
  } else if (rank === 3) {
    return { coins: config.rankCoins.third, xpMultiplier: config.xpMultiplier.third }
  } else if (rank <= 10) {
    return { coins: config.rankCoins.topTen, xpMultiplier: config.xpMultiplier.topTen }
  } else {
    return { coins: config.rankCoins.participation, xpMultiplier: config.xpMultiplier.participation }
  }
}
