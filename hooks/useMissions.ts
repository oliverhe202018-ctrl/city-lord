"use client"

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { Database } from '@/types/supabase'
import { format } from 'date-fns'

type MissionConfig = Database['public']['Tables']['mission_configs']['Row']
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
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const fetchMissions = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Fetch all active mission configs
      const { data: configs, error: configError } = await supabase
        .from('mission_configs')
        .select('*')
        .eq('is_active', true)
        .order('points_reward', { ascending: true }) // Sort by points or whatever preference

      if (configError) throw configError
      if (!configs) {
        setMissions([])
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
        // Find relevant user records for this mission code
        const relevantRecords = userMissions?.filter(um => um.mission_code === config.code) || []
        
        let isCompleted = false
        let status = 'pending'
        let currentRecord: UserMission | undefined

        if (config.frequency === 'once') {
          // For one-time missions, look for any completed record
          // Usually reset_key is 'permanent' or similar, but checking existence is enough for now
          // We assume 'completed' status means done.
          const completedRecord = relevantRecords.find(r => r.status === 'completed' || r.status === 'claimed')
          if (completedRecord) {
            isCompleted = true
            status = completedRecord.status
            currentRecord = completedRecord
          }
        } else if (config.frequency === 'daily') {
          // For daily missions, look for a record with today's reset_key
          const dailyRecord = relevantRecords.find(r => r.reset_key === today)
          if (dailyRecord && (dailyRecord.status === 'completed' || dailyRecord.status === 'claimed')) {
            isCompleted = true
            status = dailyRecord.status
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

    } catch (err: any) {
      console.error('Error fetching missions:', err)
      setError(err.message || '获取任务失败')
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  useEffect(() => {
    fetchMissions()
  }, [fetchMissions])

  // Helper to refresh data
  const refresh = () => {
    fetchMissions()
  }

  return {
    missions,
    loading,
    error,
    refresh
  }
}
