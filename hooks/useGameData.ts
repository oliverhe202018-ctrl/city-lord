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

// Hook 4: User Room Data (Legacy - fetches "current" room from DB perspective)
export function useMyRoomData() {
  return useSWR('/api/user/room', fetcher, { 
    revalidateOnFocus: false, 
    dedupingInterval: 300000, 
  })
}

// Hook 6: Specific Room Details (For UI selection)
export function useRoomDetails(roomId?: string) {
  return useSWR(roomId ? `/api/room/${roomId}` : null, fetcher, {
    revalidateOnFocus: true, // Need live participants updates
    dedupingInterval: 5000,  // Short cache for active room
    refreshInterval: 10000   // Auto-refresh every 10s
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
