"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'

export function useAuth(initialUser?: User | null) {
  const [user, setUser] = useState<User | null>(initialUser || null)
  const [loading, setLoading] = useState(!initialUser)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const broadcastAuthChanged = (event: string, nextUserId: string | null) => {
      if (typeof window === 'undefined') return
      window.dispatchEvent(new CustomEvent('citylord:auth-changed', {
        detail: { event, userId: nextUserId }
      }))
      window.dispatchEvent(new Event('citylord:refresh-territories'))
    }

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
            // Only log non-network errors or if debugging
            // console.warn("Auth check warning:", error.message)
        }
        const nextUser = session?.user ?? null
        setUser(nextUser)
        broadcastAuthChanged('SESSION_SYNC', nextUser?.id ?? null)
      } catch (e) {
        console.error("Auth check failed (network or config):", e)
        // Fallback or retry logic could go here
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      setLoading(false)
      broadcastAuthChanged(event, nextUser?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const requireAuth = (redirectUrl: string = '/login') => {
    if (!loading && !user) {
      router.push(redirectUrl)
      return false
    }
    return true
  }

  return {
    user,
    loading,
    isAuthenticated: !!user,
    requireAuth
  }
}
