"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui/spinner'
import { AccessDenied } from '@/components/admin/AccessDenied'

interface AdminGuardProps {
  children: React.ReactNode
}

export function AdminGuard({ children }: AdminGuardProps) {
  // 1. All hooks must be at the top level
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [debugError, setDebugError] = useState<string | undefined>()

  // 2. useEffect handles side effects and async logic
  useEffect(() => {
    let mounted = true

    const checkPermission = async () => {
      // If auth is still loading, do nothing yet
      if (authLoading) return

      // Case 1: User not logged in
      if (!user) {
        if (mounted) {
           // Don't redirect if loading. But here authLoading is false.
           // Just ensuring we don't loop.
           if (window.location.pathname !== '/login') {
             router.push('/login')
           }
        }
        return
      }

      // Case 2: User logged in, check admin table
      try {
        const { data, error } = await supabase
          .from('app_admins')
          .select('role')
          .eq('id', user.id)
          .single()

        if (!mounted) return

        if (error || !data) {
          // Not an admin
          console.error('Admin check failed:', error)
          setDebugError(error?.message || 'No data found in app_admins')
          setIsAuthorized(false)
        } else {
          // Is admin
          setIsAuthorized(true)
        }
      } catch (err: any) {
        console.error('Unexpected error checking admin status:', err)
        if (mounted) {
            setIsAuthorized(false)
            setDebugError(err.message || String(err))
        }
      } finally {
        if (mounted) setIsChecking(false)
      }
    }

    checkPermission()

    return () => {
      mounted = false
    }
  }, [user, authLoading, router, supabase])

  // 3. Conditional rendering comes LAST

  // Show loading state while auth is initializing or we are checking admin table
  if (authLoading || isChecking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-muted-foreground animate-pulse">验证管理员权限...</p>
        </div>
      </div>
    )
  }

  // If unauthorized (and check is done), show 403
  if (isAuthorized === false) {
    return <AccessDenied userId={user?.id} error={debugError} />
  }

  // If authorized, render children
  // Note: We check isAuthorized === true explicitly for clarity, 
  // though if isChecking is false and isAuthorized is not false, it must be true (or null if logic failed)
  if (isAuthorized === true) {
    return <>{children}</>
  }

  // Fallback (should ideally not happen if logic covers all cases)
  return null
}
