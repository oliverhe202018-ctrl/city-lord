'use client'

import { 
  useFactionStats, 
  useUserBadges, 
  useUserMissions,
  useMyRoomData,
  useClubData 
} from '@/hooks/useGameData'
import { useEffect } from 'react'

export function DataPrefetcher() {
  // Directly call hooks to trigger SWR prefetching
  // Deduping interval ensures we don't spam requests
  
  useFactionStats()
  useUserBadges()
  useUserMissions()
  
  // Prefetch Room and Club data
  useMyRoomData()
  useClubData()

  // This component renders nothing
  return null
}
