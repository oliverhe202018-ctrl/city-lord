'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  // In development, show technical details instead of the game-styled error screen
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
