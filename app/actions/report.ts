'use server'

import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from 'date-fns'

export type ReportPeriod = 'daily' | 'weekly' | 'monthly'

export interface ReportStats {
  period: ReportPeriod
  dateRange: { start: Date; end: Date }
  user: {
    nickname: string
    avatarUrl: string
    level: number
    referralCode: string
  }
  summary: {
    distance: number // km
    duration: number // seconds
    calories: number
    runsCount: number
    newTerritories: number
    newBadges: number
  }
  growth: {
    distanceChange: number // percentage
    rankChange?: number
  }
  radar: {
    speed: number // 0-100
    endurance: number // 0-100
    activity: number // 0-100
    territory: number // 0-100
    social: number // 0-100
  }
  chart: {
    date: string
    distance: number
  }[]
}

export async function getRunReport(userId: string, period: ReportPeriod = 'daily'): Promise<ReportStats | null> {
  const now = new Date()
  let start: Date, end: Date, prevStart: Date, prevEnd: Date

  // 1. Determine Date Ranges
  switch (period) {
    case 'daily':
      start = startOfDay(now)
      end = endOfDay(now)
      prevStart = startOfDay(subDays(now, 1))
      prevEnd = endOfDay(subDays(now, 1))
      break
    case 'weekly':
      start = startOfWeek(now, { weekStartsOn: 1 })
      end = endOfWeek(now, { weekStartsOn: 1 })
      prevStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      prevEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      break
    case 'monthly':
      start = startOfMonth(now)
      end = endOfMonth(now)
      prevStart = startOfMonth(subMonths(now, 1))
      prevEnd = endOfMonth(subMonths(now, 1))
      break
  }

  // 2. Fetch User Profile
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: { nickname: true, avatar_url: true, level: true, referral_code: true }
  })

  if (!profile) return null

  // 3. Aggregate Current Period Data
  const currentRuns = await prisma.runs.findMany({
    where: {
      user_id: userId,
      created_at: { gte: start, lte: end }
    },
    select: { distance: true, duration: true, created_at: true }
  })

  const newTerritories = await prisma.territories.count({
    where: {
      owner_id: userId,
      captured_at: { gte: start, lte: end }
    }
  })

  const newBadges = await prisma.user_badges.count({
    where: {
      user_id: userId,
      earned_at: { gte: start, lte: end }
    }
  })

  // 4. Aggregate Previous Period Data (for Growth)
  const prevRuns = await prisma.runs.aggregate({
    where: {
      user_id: userId,
      created_at: { gte: prevStart, lte: prevEnd }
    },
    _sum: { distance: true }
  })

  // 5. Calculations
  const totalDistance = currentRuns.reduce((acc, run) => acc + (run.distance || 0), 0) / 1000 // meters to km
  const totalDuration = currentRuns.reduce((acc, run) => acc + (run.duration || 0), 0)
  const totalCalories = Math.round(totalDistance * 60 * 1.036) // Rough estimate
  
  const prevDistance = (prevRuns._sum.distance || 0) / 1000
  const distanceChange = prevDistance > 0 
    ? ((totalDistance - prevDistance) / prevDistance) * 100 
    : totalDistance > 0 ? 100 : 0

  // 6. Radar Chart Metrics (0-100 normalization)
  // Simple heuristic normalization
  const avgPace = totalDistance > 0 ? (totalDuration / 60) / totalDistance : 0 // min/km
  const speedScore = avgPace > 0 ? Math.min(100, Math.max(0, 100 - (avgPace - 3) * 10)) : 0 // Assume 3min/km is 100, 13min/km is 0
  
  const enduranceScore = Math.min(100, (totalDistance / (period === 'daily' ? 10 : period === 'weekly' ? 50 : 200)) * 100)
  
  const runsCount = currentRuns.length
  const activityScore = Math.min(100, (runsCount / (period === 'daily' ? 1 : period === 'weekly' ? 5 : 20)) * 100)

  // Territory Score (Total owned vs gained?) -> Let's use total owned for "Territory Awareness"
  const totalTerritories = await prisma.territories.count({ where: { owner_id: userId } })
  const territoryScore = Math.min(100, (totalTerritories / 50) * 100)

  // Social Score (Invited users)
  const invitedCount = await prisma.profiles.count({ where: { invited_by: userId } })
  const socialScore = Math.min(100, (invitedCount / 10) * 100)

  // 7. Line Chart Data (Daily breakdown for the period)
  // Group by day
  const chartDataMap = new Map<string, number>()
  currentRuns.forEach(run => {
    if (!run.created_at) return
    const dateStr = run.created_at.toISOString().split('T')[0]
    const dist = (run.distance || 0) / 1000
    chartDataMap.set(dateStr, (chartDataMap.get(dateStr) || 0) + dist)
  })

  const chartData = Array.from(chartDataMap.entries()).map(([date, distance]) => ({
    date: date.slice(5), // MM-DD
    distance
  })).sort((a, b) => a.date.localeCompare(b.date))

  return {
    period,
    dateRange: { start, end },
    user: {
      nickname: profile.nickname || 'Runner',
      avatarUrl: profile.avatar_url || '',
      level: profile.level || 1,
      referralCode: profile.referral_code || userId.slice(0, 8).toUpperCase()
    },
    summary: {
      distance: parseFloat(totalDistance.toFixed(2)),
      duration: totalDuration,
      calories: totalCalories,
      runsCount,
      newTerritories,
      newBadges
    },
    growth: {
      distanceChange: parseFloat(distanceChange.toFixed(1))
    },
    radar: {
      speed: Math.round(speedScore),
      endurance: Math.round(enduranceScore),
      activity: Math.round(activityScore),
      territory: Math.round(territoryScore),
      social: Math.round(socialScore)
    },
    chart: chartData
  }
}
