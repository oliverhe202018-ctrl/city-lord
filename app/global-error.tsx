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
      <body className="flex h-full w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4 text-center select-none font-sans antialiased overflow-hidden">
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertTriangle className="h-10 w-10 text-red-600 dark:text-red-500" />
            </div>
          </div>

          <h2 className="mb-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            发生严重错误
          </h2>
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            系统遇到不可恢复的错误。您可能需要联系管理员或尝试重启。
          </p>

          <Button
            onClick={() => reset()}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg py-2"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            重启系统
          </Button>

          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
            <p className="font-mono text-[10px] text-zinc-400">
              ErrorCode: {error.digest || 'FATAL_EXCEPTION'}
            </p>
          </div>
        </div>
      </body>
    </html>
  )
}
