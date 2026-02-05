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

  // 2. useEffect handles side effects and async logic
  useEffect(() => {
    let mounted = true

    const checkPermission = async () => {
      // If auth is still loading, do nothing yet
      if (authLoading) return

      // Case 1: User not logged in
      if (!user) {
        if (mounted) {
          router.push('/login')
          // We don't set isChecking to false here because we are redirecting
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
          setIsAuthorized(false)
        } else {
          // Is admin
          setIsAuthorized(true)
        }
      } catch (err) {
        console.error('Unexpected error checking admin status:', err)
        if (mounted) setIsAuthorized(false)
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
    return <AccessDenied />
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
