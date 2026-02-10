'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export type Faction = 'RED' | 'BLUE'

export async function getFactionStats() {
  try {
    // Use Prisma to bypass RLS and get accurate counts directly from DB
    const redCount = await prisma.territory.count({ where: { faction: 'RED' } })
    const blueCount = await prisma.territory.count({ where: { faction: 'BLUE' } })

    // Calculate Area (Mock or based on hex count)
    // 1 hex ~= 0.06 sq km (approx)
    const redArea = redCount * 0.06
    const blueArea = blueCount * 0.06

    // Calculate percentages
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
  } catch (error) {
    console.error('Unexpected error in getFactionStats:', error)
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
