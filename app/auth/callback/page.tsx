"use client"

import { useEffect, useState, Suspense } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState("正在验证登录...")

  useEffect(() => {
    // Create client inside effect to avoid dependency issues, or use useMemo
    const supabase = createClient()

    let mounted = true

    const finishLogin = async () => {
      if (!mounted) return
      setStatus("登录成功，正在跳转...")
      toast.success("登录成功")
      // Close Capacitor in-app browser if running on native platform
      if (Capacitor.isNativePlatform()) {
        try { await Browser.close() } catch (_) { }
      }
      // Force reload to ensure all server components update
      window.location.href = "/"
    }

    const handleCallback = async () => {
      // 1. Check for errors in URL
      const error = searchParams.get("error")
      const errorDesc = searchParams.get("error_description")
      if (error) {
        console.error("[Auth Callback] Error:", error, errorDesc)
        if (mounted) router.push(`/auth/auth-code-error?message=${encodeURIComponent(errorDesc || error)}`)
        return
      }

      // 2. Check for "code" (PKCE Flow)
      const code = searchParams.get("code")
      if (code) {
        setStatus("正在交换会话...")
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          console.error("[Auth Callback] Exchange error:", exchangeError)
          if (mounted) router.push(`/auth/auth-code-error?message=${encodeURIComponent(exchangeError.message)}`)
          return
        }
        finishLogin()
        return
      }

      // 3. Check for Hash (Implicit Flow)
      if (window.location.hash) {
        setStatus("正在解析凭证...")
        const hash = window.location.hash.substring(1) // remove #
        const params = new URLSearchParams(hash)
        const accessToken = params.get("access_token")
        const refreshToken = params.get("refresh_token")
        const type = params.get("type")

        // If it's a recovery/magiclink flow, sometimes Supabase just needs us to set the session
        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (setSessionError) {
            console.error("[Auth Callback] Set session error:", setSessionError)
            if (mounted) router.push(`/auth/auth-code-error?message=${encodeURIComponent(setSessionError.message)}`)
            return
          }
          finishLogin()
          return
        }
      }

      // 4. Check if session already exists (handled by auto-refresh or previous tab)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        finishLogin()
        return
      }

      // 5. Setup Listener for late arrivals (e.g. cookie being set by other process)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || session) {
          finishLogin()
        }
      })

      // 6. Timeout fallback
      setTimeout(() => {
        if (mounted) {
          // Re-check session one last time
          supabase.auth.getSession().then(({ data }) => {
            if (!data.session) {
              console.warn("[Auth Callback] Timeout waiting for session")
              router.push("/auth/auth-code-error?message=登录超时，未找到凭证")
            } else {
              finishLogin()
            }
          })
        }
      }, 3000) // Wait 3s

      return () => {
        subscription.unsubscribe()
      }
    }

    handleCallback()

    return () => {
      mounted = false
    }
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1a] text-white">
      <Loader2 className="h-10 w-10 animate-spin text-green-500 mb-4" />
      <p className="text-white/60">{status}</p>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0f1a] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-green-500 mb-4" />
        <p className="text-white/60">加载中...</p>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
