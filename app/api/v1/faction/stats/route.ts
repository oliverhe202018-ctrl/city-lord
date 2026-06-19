import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { calculateFactionBonus } from '@/lib/game-logic/faction-balance'

const getCachedFactionStats = unstable_cache(
  async () => {
    let red_count = 0
    let blue_count = 0

    const [rCount, bCount] = await Promise.all([
      prisma.profiles.count({ where: { faction: 'Red' } }),
      prisma.profiles.count({ where: { faction: 'Blue' } })
    ])

    red_count = rCount
    blue_count = bCount

    // Fire-and-forget daily snapshot
    ;(async () => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        await prisma.daily_stats.upsert({
          where: { date: today },
          update: { red_count, blue_count },
          create: { date: today, red_count, blue_count, total_territories: 0 }
        })
      } catch (e) {
        console.warn('Failed to update DailyStat:', e)
      }
    })()

    let redArea = 0
    let blueArea = 0

    const snapshot = await prisma.faction_stats_snapshot.findFirst({
      orderBy: { updated_at: 'desc' }
    })

    if (snapshot) {
      redArea = snapshot.red_area
      blueArea = snapshot.blue_area
    } else {
      const [redAgg, blueAgg] = await Promise.all([
        prisma.profiles.aggregate({ _sum: { total_area: true }, where: { faction: 'Red' } }),
        prisma.profiles.aggregate({ _sum: { total_area: true }, where: { faction: 'Blue' } })
      ])
      redArea = redAgg._sum.total_area || 0
      blueArea = blueAgg._sum.total_area || 0
    }

    const totalCount = red_count + blue_count
    const redPercent = totalCount > 0 ? (red_count / totalCount) * 100 : 50
    const bluePercent = totalCount > 0 ? (blue_count / totalCount) * 100 : 50

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

    const balanceResult = calculateFactionBonus(red_count, blue_count)

    return {
      RED: red_count,
      BLUE: blue_count,
      redArea,
      blueArea,
      percentages: {
        RED: parseFloat(redPercent.toFixed(1)),
        BLUE: parseFloat(bluePercent.toFixed(1))
      },
      bonus: {
        RED: balanceResult.RED,
        BLUE: balanceResult.BLUE
      }
    }
  },
  ['faction-stats'],
  { revalidate: 60, tags: ['faction-stats'] }
)

export async function GET() {
  try {
    const result = await Promise.race([
      getCachedFactionStats(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database timeout')), 10000)
      )
    ])
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('getFactionStats failed or timed out:', error)
    return NextResponse.json({
      success: true,
      data: {
        RED: 0, BLUE: 0, redArea: 0, blueArea: 0,
        percentages: { RED: 50, BLUE: 50 },
        bonus: { RED: 0, BLUE: 0 }
      }
    })
  }
}
