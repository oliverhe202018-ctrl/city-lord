'use client'
 
import { useEffect } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import './globals.css'
 
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])
 
  return (
    <html lang="zh-CN" className="h-full">
      <body className="h-full bg-zinc-950 text-white font-sans antialiased overflow-hidden">
        <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center select-none">
          <div className="relative mb-6">
            <div className="absolute inset-0 animate-pulse rounded-full bg-red-500/20 blur-xl"></div>
            <AlertTriangle className="relative h-20 w-20 text-red-500" />
          </div>
          
          <h2 className="mb-2 text-3xl font-bold tracking-tight text-white font-mono">
            CRITICAL ERROR
          </h2>
          <p className="mb-8 max-w-xs text-sm text-zinc-400 font-mono">
            系统遇到不可恢复的错误。
            <br />
            System encountered an unrecoverable error.
          </p>

          <div className="flex gap-4">
            <Button 
              onClick={() => reset()}
              className="bg-red-600 hover:bg-red-700 text-white gap-2 font-bold px-8 py-6 rounded-xl border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all"
            >
              <RefreshCcw className="h-5 w-5" />
              紧急重启 FORCE REBOOT
            </Button>
          </div>
          
          <div className="mt-12 font-mono text-[10px] text-zinc-600">
            ERROR_HASH: {error.digest || 'FATAL_EXCEPTION'}
          </div>
        </div>
      </body>
    </html>
  )
}
