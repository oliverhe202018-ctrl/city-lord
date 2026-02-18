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

  // Component lifecycle errors (tab switch unmount race conditions)
  if (
    msg.includes('unmounted') ||
    msg.includes('destroyed') ||
    msg.includes('disposed') ||
    msg.includes('not mounted') ||
    msg.includes('cannot update') ||
    msg.includes('unmount')
  ) return 'non-critical'

  // Dynamic import / lazy-load failures during rapid navigation
  if (
    msg.includes('dynamic') ||
    msg.includes('import') ||
    msg.includes('module')
  ) return 'transient'

  // Supabase realtime channel errors (non-fatal background)
  if (
    msg.includes('supabase') ||
    msg.includes('channel') ||
    msg.includes('subscription') ||
    msg.includes('realtime')
  ) return 'non-critical'

  // Hydration mismatches (SSR→CSR, recoverable)
  if (
    msg.includes('hydration') ||
    msg.includes('hydrat') ||
    msg.includes('server html') ||
    msg.includes('mismatch')
  ) return 'non-critical'

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

  // Map / AMap related errors (non-fatal)
  if (
    msg.includes('bindbindbindbindlbindbindbindlbindbindlapwindbindwindwindlbindwindapap') ||
    msg.includes('bindbindbbindbin') ||
    msg.includes('amap') ||
    msg.includes('bindbindlbindlbindwind')
  ) return 'non-critical'

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
    <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 text-center select-none">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-500" />
          </div>
        </div>

        <h2 className="mb-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          系统遇到了一点问题
        </h2>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          应用运行过程中发生了异常。如果是网络问题，请尝试刷新。
        </p>

        <div className="flex flex-col gap-3">
          <Button
            onClick={reset}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg py-2"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            重试
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            刷新页面
          </Button>
        </div>

        <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <p className="font-mono text-[10px] text-zinc-400">
            CODE: {error.digest || 'UNKNOWN_ERROR'}
          </p>
        </div>
      </div>
    </div>
  )
}
