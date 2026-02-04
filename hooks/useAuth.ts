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
      // If we already have initialUser, we might still want to verify session validity
      // but for UI responsiveness, we trust it initially.
      // However, onAuthStateChange will catch updates.
      
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
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
