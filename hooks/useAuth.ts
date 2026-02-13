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
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
            // Only log non-network errors or if debugging
            // console.warn("Auth check warning:", error.message)
        }
        setUser(session?.user ?? null)
      } catch (e) {
        console.error("Auth check failed (network or config):", e)
        // Fallback or retry logic could go here
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
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
