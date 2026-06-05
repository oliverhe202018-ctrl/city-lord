'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calculateFactionBalance } from '@/utils/faction-balance'
import { revalidatePath } from 'next/cache'

export type Faction = 'RED' | 'BLUE'

export async function getFactionStats() {
  const fetchLogic = async () => {
    // 1. Get Member Counts (Always Real-time for Accuracy)
    // User requested "real numbers", so we skip the potentially stale snapshot for current display.
    let redCount = 0
    let blueCount = 0

    const [rCount, bCount] = await Promise.all([
      prisma.profiles.count({ where: { faction: 'Red' } }),
      prisma.profiles.count({ where: { faction: 'Blue' } })
    ])

    redCount = rCount
    blueCount = bCount;

    // Background: Update or Create Daily Snapshot for History
    // We don't await this to keep UI fast
    (async () => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        await prisma.dailyStat.upsert({
          where: { date: today },
          update: {
            redCount,
            blueCount,
            // We don't update totalTerritories here as it requires another query
          },
          create: {
            date: today,
            redCount,
            blueCount,
            totalTerritories: 0
          }
        })
      } catch (e) {
        console.warn('Failed to update DailyStat:', e)
      }
    })()

    // 2. Get Area Counts (Optimized: Use Snapshot)
    // The previous real-time calculation on 'territories' table was too slow (causing 10s delay).
    // We now prefer the cached snapshot or aggregate from profiles.
    let redArea = 0
    let blueArea = 0

    const snapshot = await prisma.faction_stats_snapshot.findFirst({
      orderBy: { updated_at: 'desc' }
    })

    if (snapshot) {
      redArea = snapshot.red_area
      blueArea = snapshot.blue_area
    } else {
      // Fallback: Aggregate from profiles (Faster than territories join)
      // This assumes profile.total_area is kept in sync with territory captures
      const [redAgg, blueAgg] = await Promise.all([
        prisma.profiles.aggregate({
          _sum: { total_area: true },
          where: { faction: 'Red' }
        }),
        prisma.profiles.aggregate({
          _sum: { total_area: true },
          where: { faction: 'Blue' }
        })
      ])

      redArea = redAgg._sum.total_area || 0
      blueArea = blueAgg._sum.total_area || 0
    }

    // Calculate percentages
    const totalCount = redCount + blueCount
    const redPercent = totalCount > 0 ? (redCount / totalCount) * 100 : 50
    const bluePercent = totalCount > 0 ? (blueCount / totalCount) * 100 : 50

    // Fetch config for calculateFactionBalance
    let balanceConfig = {
      imbalance_threshold: 20,
      underdog_multiplier: 1.5,
      auto_balance_enabled: true
    }

    try {
      const configSnapshot = await prisma.faction_balance_configs.findFirst({
        orderBy: { id: 'asc' }
      })
      if (configSnapshot) {
        balanceConfig = {
          imbalance_threshold: configSnapshot.imbalance_threshold ? Number(configSnapshot.imbalance_threshold) : 20,
          underdog_multiplier: configSnapshot.underdog_multiplier ? Number(configSnapshot.underdog_multiplier) : 1.5,
          auto_balance_enabled: configSnapshot.auto_balance_enabled ?? true
        }
      }
    } catch (e) {
      console.warn('Failed to fetch faction_balance_configs, using defaults', e)
    }

    // Calculate Bonus using dynamic utility
    const balanceResult = calculateFactionBalance(
      redCount,
      blueCount,
      balanceConfig.auto_balance_enabled,
      balanceConfig.imbalance_threshold,
      balanceConfig.underdog_multiplier
    )

    let redBonus = 0
    let blueBonus = 0

    if (balanceResult.underdog === 'red') {
      redBonus = Math.round((balanceResult.multiplier - 1.0) * 100)
    } else if (balanceResult.underdog === 'blue') {
      blueBonus = Math.round((balanceResult.multiplier - 1.0) * 100)
    }

    return {
      RED: redCount,
      BLUE: blueCount,
      redArea,
      blueArea,
      percentages: {
        RED: parseFloat(redPercent.toFixed(1)),
        BLUE: parseFloat(bluePercent.toFixed(1))
      },
      bonus: {
        RED: redBonus,
        BLUE: blueBonus
      }
    }
  }

  try {
    // Timeout wrapper: 10 seconds limit (increased from 3s for cold starts)
    const result = await Promise.race([
      fetchLogic(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), 10000)
      )
    ])
    return result
  } catch (error) {
    console.error('getFactionStats failed or timed out:', error)
    // Fallback data to prevent page crash
    return {
      RED: 0,
      BLUE: 0,
      redArea: 0,
      blueArea: 0,
      percentages: { RED: 50, BLUE: 50 },
      bonus: { RED: 0, BLUE: 0 }
    }
  }
}

export async function joinFaction(faction: Faction) {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    const profile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { last_faction_change_at: true, faction: true },
    })

    if (profile?.last_faction_change_at) {
      const daysSinceChange = (Date.now() - profile.last_faction_change_at.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceChange < 7) {
        const remaining = Math.ceil(7 - daysSinceChange)
        return { success: false, error: `阵营冷却中，请 ${remaining} 天后再试` }
      }
    }

    if (profile?.faction === (faction === 'RED' ? 'Red' : 'Blue')) {
      return { success: false, error: '你已经在该阵营中' }
    }

    await prisma.profiles.update({
      where: { id: user.id },
      data: {
        faction: faction === 'RED' ? 'Red' : 'Blue',
        last_faction_change_at: new Date(),
      },
    })

    revalidatePath('/', 'layout')

    return { success: true }
  } catch (err: any) {
    console.error('Join faction exception:', err)
    return { success: false, error: err.message || 'Unknown error' }
  }
}

export async function getDailyStats() {
  try {
    const stat = await prisma.dailyStat.findFirst({
      orderBy: { date: 'desc' }
    })
    return stat
  } catch (error) {
    console.error('Error fetching daily stats:', error)
    return null
  }
}

// ─── Faction Leaderboard ────────────────────────────────────────────────────

export type FactionLeaderboardEntry = {
  faction: string          // 'Red' | 'Blue'
  displayName: string      // '赤焰军' | '苍龙营'
  color: string            // hex color for UI rendering
  totalArea: number        // m² (after bonus applied)
  baseArea: number         // m² (before bonus)
  bonusPercent: number     // e.g. 50 for +50% bonus
  memberCount: number
  rank: number
}

/** 阵营定义表 —— 扩展阵营时仅需在此处添加 */
const FACTION_META: Record<string, { displayName: string; color: string }> = {
  Red:  { displayName: '赤焰军', color: '#EF4444' },
  Blue: { displayName: '苍龙营', color: '#3B82F6' },
}

export async function getFactionLeaderboard(): Promise<FactionLeaderboardEntry[]> {
  try {
    // 1. 从 territories 聚合有效领地面积（跳过 SUPERSEDED / DESTROYED）
    const areaRows = await prisma.territories.groupBy({
      by: ['owner_faction'],
      where: {
        owner_faction: { not: null },
        status: 'ACTIVE',
        destroyed_at: null,
      },
      _sum: { area_m2_exact: true },
    })

    // 2. 从 profiles 聚合各阵营成员数
    const memberRows = await prisma.profiles.groupBy({
      by: ['faction'],
      where: {
        faction: { not: null },
        is_active: true,
      },
      _count: { id: true },
    })

    const memberMap = new Map<string, number>(
      memberRows.map((r) => [r.faction!, r._count.id])
    )

    // 3. 计算阵营平衡系数 (Calculate Faction Balance Bonus)
    const redCount = memberMap.get('Red') || 0
    const blueCount = memberMap.get('Blue') || 0

    let balanceConfig = {
      imbalance_threshold: 20,
      underdog_multiplier: 1.5,
      auto_balance_enabled: true
    }
    try {
      const configSnapshot = await prisma.faction_balance_configs.findFirst({
        orderBy: { id: 'asc' }
      })
      if (configSnapshot) {
        balanceConfig = {
          imbalance_threshold: configSnapshot.imbalance_threshold ? Number(configSnapshot.imbalance_threshold) : 20,
          underdog_multiplier: configSnapshot.underdog_multiplier ? Number(configSnapshot.underdog_multiplier) : 1.5,
          auto_balance_enabled: configSnapshot.auto_balance_enabled ?? true
        }
      }
    } catch (e) {
      console.warn('Failed to fetch faction_balance_configs, using defaults', e)
    }

    const balanceResult = calculateFactionBalance(
      redCount,
      blueCount,
      balanceConfig.auto_balance_enabled,
      balanceConfig.imbalance_threshold,
      balanceConfig.underdog_multiplier
    )

    let redBonusPercent = 0
    let blueBonusPercent = 0

    if (balanceResult.underdog === 'red') {
      redBonusPercent = Math.round((balanceResult.multiplier - 1.0) * 100)
    } else if (balanceResult.underdog === 'blue') {
      blueBonusPercent = Math.round((balanceResult.multiplier - 1.0) * 100)
    }

    // 4. 合并并按面积降序排列
    const entries: Omit<FactionLeaderboardEntry, 'rank'>[] = areaRows
      .filter((r) => r.owner_faction && r.owner_faction in FACTION_META)
      .map((r) => {
        const key = r.owner_faction!
        const meta = FACTION_META[key]
        
        const baseArea = r._sum.area_m2_exact ?? 0
        const bonusPercent = key === 'Red' ? redBonusPercent : (key === 'Blue' ? blueBonusPercent : 0)
        const totalArea = baseArea * (1 + bonusPercent / 100)
        
        return {
          faction:     key,
          displayName: meta.displayName,
          color:       meta.color,
          totalArea:   totalArea,
          baseArea:    baseArea,
          bonusPercent: bonusPercent,
          memberCount: memberMap.get(key) ?? 0,
        }
      })
      .sort((a, b) => b.totalArea - a.totalArea)

    return entries.map((entry, idx) => ({ ...entry, rank: idx + 1 }))
  } catch (error) {
    console.error('[getFactionLeaderboard] failed:', error)
    return []
  }
}
