import { createClient } from '@/lib/supabase/client'

export type Faction = 'RED' | 'BLUE'

export async function getFactionStats() {
  const supabase = createClient()
  
  try {
    // 1. Get Member Counts from RPC (Single fast query)
    const { data: summary, error: rpcError } = await supabase.rpc('get_dashboard_summary')
    
    if (rpcError) {
      console.error('Error fetching faction counts (RPC):', rpcError)
    }

    const redCount = summary?.red_faction || 0
    const blueCount = summary?.blue_faction || 0

    // 2. Get Area Stats from Snapshot Table
    const { data: areaStats, error: areaError } = await supabase
      .from('faction_stats_snapshot')
      .select('red_area, blue_area')
      .maybeSingle()

    if (areaError) {
      console.error('Error fetching faction area stats:', areaError)
    }

    const redArea = Number(areaStats?.red_area || 0)
    const blueArea = Number(areaStats?.blue_area || 0)

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
    const supabase = createClient()
    
    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Not authenticated' }
        
        // Update profile
        const { error } = await supabase
            .from('profiles')
            .update({ faction: faction === 'RED' ? 'red' : 'blue' })
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
