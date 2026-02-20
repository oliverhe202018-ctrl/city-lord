"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Database } from '@/types/supabase'
import { format } from 'date-fns'

type MissionConfig = Database['public']['Tables']['missions']['Row']
type UserMission = Database['public']['Tables']['user_missions']['Row']

export type MissionWithStatus = MissionConfig & {
  isCompleted: boolean
  status: string // 'pending', 'completed', 'claimed'
  progress?: UserMission // Optional reference to the user record
}

export function useMissions() {
  const { user } = useAuth()
  const [missions, setMissions] = useState<MissionWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const CACHE_KEY = 'CACHE_TASKS_DATA'

  const fetchMissions = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    // Set fetching state for background updates
    setIsFetching(true)
    setError(null)

    try {
      // 1. Fetch all active mission configs (from missions table)
      const { data: configs, error: configError } = await supabase
        .from('missions')
        .select('*')
        .order('reward_coins', { ascending: true }) // Sort by reward

      if (configError) throw configError
      if (!configs) {
        setMissions([])
        if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY) // Clear cache if no data
        return
      }

      // 2. Fetch user's progress
      const { data: userMissions, error: userError } = await supabase
        .from('user_missions')
        .select('*')
        .eq('user_id', user.id)

      if (userError) throw userError

      // 3. Merge data
      const today = format(new Date(), 'yyyy-MM-dd')

      const mergedMissions: MissionWithStatus[] = configs.map(config => {
        // Find relevant user records for this mission id
        const relevantRecords = userMissions?.filter((um: any) => um.mission_id === config.id) || []

        let isCompleted = false
        let status = 'pending'
        let currentRecord: UserMission | undefined

        if (config.frequency === 'once') {
          // For one-time missions, look for any completed record
          // Usually reset_key is 'permanent' or similar, but checking existence is enough for now
          // We assume 'completed' status means done.
          const completedRecord = relevantRecords.find((r: any) => r.status === 'completed' || r.status === 'claimed')
          if (completedRecord) {
            isCompleted = true
            status = completedRecord.status || 'completed'
            currentRecord = completedRecord
          }
        } else if (config.frequency === 'daily') {
          // For daily missions, look for a record with today's reset_key
          const dailyRecord = relevantRecords.find((r: any) => r.reset_key === today)
          if (dailyRecord && (dailyRecord.status === 'completed' || dailyRecord.status === 'claimed')) {
            isCompleted = true
            status = dailyRecord.status || 'completed'
            currentRecord = dailyRecord
          }
        } else if (config.frequency === 'weekly') {
          // Logic for weekly can be added here (e.g., reset_key = '2023-W42')
          // For now, treat same as daily logic logic if needed or default to not completed
        }

        return {
          ...config,
          isCompleted,
          status,
          progress: currentRecord
        }
      })

      setMissions(mergedMissions)

      // Update cache (SSR-safe)
      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify(mergedMissions))
      }

    } catch (err: any) {
      console.error('Error fetching missions:', err)
      setError(err.message || '获取任务失败')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [user, supabase])

  useEffect(() => {
    // 1. Try to load from cache immediately (SSR-safe)
    if (typeof window !== 'undefined') {
      const cachedData = localStorage.getItem(CACHE_KEY)
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData)
          setMissions(parsed)
          setLoading(false) // Show cached data immediately
        } catch (e) {
          console.error('[useMissions] Failed to parse cached missions:', e)
        }
      }
    }

    // 2. Fetch fresh data
    fetchMissions()
  }, [fetchMissions])

  // Helper to refresh data
  const refresh = () => {
    fetchMissions()
  }

  return {
    missions,
    loading,
    isFetching,
    error,
    refresh
  }
}
