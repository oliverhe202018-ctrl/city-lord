'use client'

import { useFactionStats, useUserBadges, useUserMissions } from '@/hooks/useGameData'
import { useEffect } from 'react'

export function DataPrefetcher() {
  // Directly call hooks to trigger SWR prefetching
  // Deduping interval ensures we don't spam requests
  
  useFactionStats()
  useUserBadges()
  useUserMissions()

  // This component renders nothing
  return null
}
