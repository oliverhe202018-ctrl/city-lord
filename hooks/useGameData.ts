'use client'

import useSWR from 'swr'
import { useGameStore } from '@/store/useGameStore'

// Unified fetcher for API routes
const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Hook 1: Faction Stats
export function useFactionStats() {
  return useSWR('/api/faction/stats', fetcher, {
    revalidateOnFocus: false, // Homepage doesn't need frequent updates
    dedupingInterval: 60000,   // 1 minute deduping
  })
}

// Hook 2: User Badges (Medal Wall)
export function useUserBadges() {
  return useSWR('/api/user/badges', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes deduping, badges don't change often
  })
}

// Hook 3: User Missions
export function useUserMissions() {
  return useSWR('/api/missions', fetcher, {
    revalidateOnFocus: true, // Mission status might change
    dedupingInterval: 10000, // 10 seconds deduping
  })
}

// Hook 4: User Room Data
export function useMyRoomData() {
  return useSWR('/api/user/room', fetcher, { 
    revalidateOnFocus: false, // Room decor/status doesn't change often
    dedupingInterval: 300000, // 5 minutes cache
  })
}

// Hook 5: Club Data
export function useClubData() {
  const userId = useGameStore((state) => state.userId)
  
  return useSWR(userId ? '/api/club/info' : null, fetcher, { 
    revalidateOnFocus: true,  // Club messages/members might update
    dedupingInterval: 60000,  // 1 minute cache
  })
}
