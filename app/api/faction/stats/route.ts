import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Group by faction to handle case sensitivity and get accurate counts
    const factionGroups = await prisma.profile.groupBy({
      by: ['faction'],
      _count: { faction: true },
    })

    // Normalize and aggregate counts
    let redCount = 0
    let blueCount = 0

    factionGroups.forEach(group => {
      if (!group.faction) return
      const faction = group.faction.toLowerCase()
      if (faction === 'red') redCount += group._count.faction
      if (faction === 'blue') blueCount += group._count.faction
    })

    // Calculate area based on territories owned by users of each faction
    // We use a case-insensitive check for faction
    const redAreaCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: { equals: 'Red', mode: 'insensitive' }
        }
      }
    })
    
    const blueAreaCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: { equals: 'Blue', mode: 'insensitive' }
        }
      }
    })

    const redArea = redAreaCount * 0.06
    const blueArea = blueAreaCount * 0.06

    return NextResponse.json({
      red_faction: redCount,
      blue_faction: blueCount,
      red_area: redArea || 0,
      blue_area: blueArea || 0
    })
  } catch (error: any) {
    console.error('Faction Stats Error:', error)
    // Return safe default instead of error to prevent UI crash
    return NextResponse.json({
      red_faction: 0,
      blue_faction: 0,
      red_area: 0,
      blue_area: 0
    })
  }
}
