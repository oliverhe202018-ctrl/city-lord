'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, RefreshCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * Classify error severity to decide UI treatment.
 * 'transient' = network/timeout/fetch → auto-retry + toast
 * 'non-critical' = analytics, AbortError, redirect → toast only
 * 'critical' = render crash, unknown → full-screen error
 */
function classifyError(error: Error & { digest?: string }): 'transient' | 'non-critical' | 'critical' {
  const msg = (error.message || '').toLowerCase()
  const digest = (error.digest || '').toLowerCase()

  // Next.js redirect is not an error
  if (digest === 'next_redirect' || msg.includes('next_redirect')) return 'non-critical'

  // AbortError from cancelled fetch
  if (error.name === 'AbortError' || msg.includes('aborterror')) return 'non-critical'

  // Network / fetch / timeout errors are transient
  if (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror')
  ) return 'transient'

  // Analytics / tracking failures
  if (msg.includes('analytics') || msg.includes('tracking') || msg.includes('beacon')) return 'non-critical'

  // ChunkLoadError (dynamic import failure, usually transient)
  if (msg.includes('chunkloaderror') || msg.includes('loading chunk')) return 'transient'

  return 'critical'
}

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const hasAutoRetried = useRef(false)
  const [dismissed, setDismissed] = useState(false)
  const severity = classifyError(error)

  useEffect(() => {
    console.error('[ErrorBoundary]', severity, error)
  }, [error, severity])

  // Auto-retry once for transient errors
  useEffect(() => {
    if (severity === 'transient' && !hasAutoRetried.current) {
      hasAutoRetried.current = true
      toast.error("网络异常", { description: "正在自动重试...", duration: 2000 })
      const timer = setTimeout(() => reset(), 1000)
      return () => clearTimeout(timer)
    }
  }, [severity, reset])

  // Non-critical errors: just show a toast and try to recover
  useEffect(() => {
    if (severity === 'non-critical') {
      toast.warning("操作异常", {
        description: error.message || "发生了一个非关键错误",
        duration: 3000
      })
      // Auto-recover immediately
      const timer = setTimeout(() => reset(), 100)
      return () => clearTimeout(timer)
    }
  }, [severity, error, reset])

  // For transient/non-critical, show nothing (toast handles it, auto-retry resets)
  if (severity !== 'critical' || dismissed) {
    return null
  }

  // === Development mode: show full stack trace ===
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="flex h-screen w-full flex-col items-start justify-start bg-zinc-950 p-8 text-left overflow-auto font-mono">
        <h2 className="text-xl font-bold text-red-500 mb-4">DEV MODE ERROR</h2>
        <div className="bg-zinc-900 p-4 rounded-lg w-full mb-4 border border-red-900/50">
          <p className="text-white font-bold mb-2">{error.name}: {error.message}</p>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap">{error.stack}</pre>
        </div>
        <div className="flex gap-4">
          <Button onClick={reset} variant="secondary">
            Retry Render
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reload Page
          </Button>
        </div>
      </div>
    )
  }

  // === Production: Critical error full-screen ===
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-950 p-4 text-center select-none">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-pulse rounded-full bg-red-500/20 blur-xl"></div>
        <AlertTriangle className="relative h-20 w-20 text-red-500" />
      </div>

      <h2 className="mb-2 text-2xl font-bold tracking-tight text-white font-mono">
        系统故障 SYSTEM FAILURE
      </h2>
      <p className="mb-8 max-w-xs text-sm text-zinc-400 font-mono">
        检测到异常信号干扰。请尝试重启系统以恢复连接。
      </p>

      <div className="flex gap-4">
        <Button
          onClick={reset}
          className="bg-red-600 hover:bg-red-700 text-white gap-2 font-bold px-8 py-6 rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all"
        >
          <RefreshCcw className="h-5 w-5" />
          重启系统 REBOOT
        </Button>
      </div>

      <div className="mt-12 font-mono text-[10px] text-zinc-600">
        ERROR_CODE: {error.digest || 'UNKNOWN_ANOMALY'}
      </div>
    </div>
  )
}
