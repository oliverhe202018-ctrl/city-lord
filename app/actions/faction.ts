'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

    // Calculate percentages (based on Members or Area? Usually Area for domination, but Members for balance)
    // Let's use Members for the "RED/BLUE" count return, and Area for "redArea/blueArea"
    // The "percentages" usually refer to population balance in this context
    const totalCount = redCount + blueCount
    const redPercent = totalCount > 0 ? (redCount / totalCount) * 100 : 50
    const bluePercent = totalCount > 0 ? (blueCount / totalCount) * 100 : 50

    // Calculate Bonus (Mock logic or derived from stats)
    // If one faction is significantly behind, give them a bonus
    const imbalanceThreshold = 20 // 20% difference
    const diff = Math.abs(redPercent - bluePercent)
    
    let redBonus = 0
    let blueBonus = 0

    if (diff > imbalanceThreshold) {
      // The underdog gets a bonus
      if (redPercent < bluePercent) {
        redBonus = 10 // 10% bonus
      } else {
        blueBonus = 10
      }
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
        
        // Update profile
        const { error } = await supabase
            .from('profiles')
            .update({ faction: faction === 'RED' ? 'Red' : 'Blue' })
            .eq('id', user.id)
            
        if (error) {
            console.error('Join faction error:', error)
            return { success: false, error: error.message }
        }
        
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
