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
