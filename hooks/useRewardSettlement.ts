"use client"

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '@/store/useGameStore'
import type { CelebrationEvent } from '@/store/useGameStore'

interface RewardSettlementResponse {
  status: 'PENDING' | 'COMPLETED' | 'ERROR'
  data?: {
    leveledUp: boolean
    newLevel: number
    rewardSummary: {
      totalPoints: number
      totalLevelXp: number
      maxAreaMultiplier: number
    }
    reward_coins: number
    reward_xp: number
    reward_territories: number
  }
  error?: string
}

export function useRewardSettlement(runId: string | undefined) {
  const queryClient = useQueryClient()
  const startTimeRef = useRef<number>(Date.now())
  const enqueueCelebrations = useGameStore((state) => state.enqueueCelebrations)
  const hasPolledPendingRef = useRef<boolean>(false)

  const fetchPendingRewards = useCallback(async () => {
    try {
      const res = await fetch('/api/user/pending-rewards')
      if (!res.ok) return
      const data = await res.json()
      if (data.rewards && data.rewards.length > 0) {
        const events: CelebrationEvent[] = data.rewards.map((r: any) => ({
          id: r.id,
          type: r.rewardType,
          payload: r.payload
        }))
        enqueueCelebrations(events)
        await fetch('/api/user/pending-rewards', { method: 'POST' })
      }
    } catch (err) {
      console.error('[useRewardSettlement] Failed to fetch pending rewards:', err)
    }
  }, [enqueueCelebrations])

  // Anti-Freeze: Force refresh when app resumes from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Invalidate queries immediately when app resumes
        queryClient.invalidateQueries({ 
          queryKey: ['run-rewards', runId] 
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient, runId])

  // Fetch pending rewards when settlement completes
  useEffect(() => {
    if (data?.status === 'COMPLETED' && !hasPolledPendingRef.current) {
      hasPolledPendingRef.current = true
      fetchPendingRewards()
    }
  }, [data?.status, fetchPendingRewards])

  const { data, error, isLoading, isError } = useQuery<RewardSettlementResponse>({
    queryKey: ['run-rewards', runId],
    queryFn: async () => {
      if (!runId) {
        throw new Error('Run ID is required')
      }
      
      const response = await fetch(`/api/runs/${runId}/rewards`)
      if (!response.ok) {
        throw new Error(`Failed to fetch reward status: ${response.status}`)
      }
      return response.json()
    },
    refetchInterval: (query) => {
      const data = query.state.data
      const now = Date.now()
      const elapsed = now - startTimeRef.current
      
      // Hard Timeout: Prevent infinite polling on worker failure (3-minute timeout)
      if (elapsed > 180000) {
        console.warn('Reward settlement polling timeout after 3 minutes')
        return false
      }
      
      // Stop polling when completed
      return data?.status === 'COMPLETED' ? false : 2000
    },
    enabled: !!runId,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 0, // Always consider data stale for immediate refetch
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  })

  return {
    data,
    error,
    isLoading,
    isError,
    isCompleted: data?.status === 'COMPLETED',
    isPending: data?.status === 'PENDING',
    hasError: data?.status === 'ERROR' || isError,
    // Expose specific reward data for easy consumption
    rewardData: data?.status === 'COMPLETED' ? data.data : undefined,
  }
}