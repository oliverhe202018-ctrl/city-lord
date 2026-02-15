import { prisma } from '@/lib/prisma'

export interface UserProfileStats {
  totalTiles: number
  totalArea: number
  totalDistance: number
  battlesWon: number
  level: number
  xp: number
  coins: number
  faction: string | null
}

export async function fetchUserProfileStats(userId: string): Promise<UserProfileStats> {
  // 1. Fetch Profile Data
  const profile = await prisma.profiles.findUnique({
    where: { id: userId },
    select: {
      level: true,
      current_exp: true,
      total_distance_km: true,
      coins: true,
      faction: true
    }
  })

  // 2. Fetch City Progress (for Area/Tiles aggregation)
  const progress = await prisma.user_city_progress.findMany({
    where: { user_id: userId },
    select: {
      tiles_captured: true,
      area_controlled: true
    }
  })

  let totalTiles = 0
  let totalArea = 0

  if (progress) {
    progress.forEach((p) => {
      totalTiles += (p.tiles_captured || 0)
      const area = p.area_controlled
      totalArea += (area && typeof area === 'object' && 'toNumber' in area) 
        ? (area as any).toNumber() 
        : Number(area || 0)
    })
  }

  return {
    totalTiles,
    totalArea,
    totalDistance: profile?.total_distance_km || 0,
    battlesWon: 0, // Placeholder
    level: profile?.level || 1,
    xp: profile?.current_exp || 0,
    coins: profile?.coins || 0,
    faction: profile?.faction || null
  }
}
