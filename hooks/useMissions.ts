"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Database } from '@/types/supabase'

type MissionConfig = Database['public']['Tables']['missions']['Row']
type UserMission = Database['public']['Tables']['user_missions_deprecated']['Row']

export type MissionWithStatus = MissionConfig & {
  isCompleted: boolean
  status: string 
  progress?: UserMission 
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

    setIsFetching(true)
    setError(null)

    try {
      const { data: configs, error: configError } = await supabase
        .from('missions')
        .select('*')
        .order('reward_coins', { ascending: true })

      if (configError) throw configError
      if (!configs) {
        setMissions([])
        if (typeof window !== 'undefined') localStorage.removeItem(CACHE_KEY)
        return
      }

      const { data: userMissions, error: userError } = await supabase
        .from('user_missions')
        .select('*')
        .eq('user_id', user.id)

      if (userError) throw userError

      const statusPriority: Record<string, number> = {
        'claimed': 0, 'completed': 1, 'ongoing': 2, 'in-progress': 2, 'active': 2, 'todo': 2
      }

      const mergedMissions: MissionWithStatus[] = configs.map(config => {
        const relevantRecords = userMissions?.filter((um: any) => um.mission_id === config.id) || []

        const sortedRecords = [...relevantRecords].sort((a: any, b: any) => {
          const orderA = statusPriority[a.status || ''] ?? 99
          const orderB = statusPriority[b.status || ''] ?? 99
          if (orderA !== orderB) return orderA - orderB
          return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
        })

        const currentRecord = sortedRecords[0] as any
        const status = currentRecord?.status || 'pending'
        const isCompleted = status === 'completed' || status === 'claimed'

        return {
          ...config,
          isCompleted,
          status,
          progress: currentRecord
        }
      })

      setMissions(mergedMissions)

      if (typeof window !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify(mergedMissions))
      }

    } catch (err: any) {
      console.error('Error fetching missions:', err)
      setError(err.message || '鑾峰彇浠诲姟澶辫触')
    } finally {
      setLoading(false)
      setIsFetching(false)
    }
  }, [user, supabase])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedData = localStorage.getItem(CACHE_KEY)
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData)
          setMissions(parsed)
          setLoading(false)
        } catch (e) {
          console.error('[useMissions] Failed to parse cached missions:', e)
        }
      }
    }
    fetchMissions()
  }, [fetchMissions])

  const refresh = () => { fetchMissions() }

  return { missions, loading, isFetching, error, refresh }
}
