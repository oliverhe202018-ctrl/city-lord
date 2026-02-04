'use client'
import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 w-full bg-red-500/90 backdrop-blur-sm text-white text-center text-xs font-medium py-1.5 z-[100] animate-in slide-in-from-top flex items-center justify-center gap-2 shadow-lg">
      <WifiOff className="w-3 h-3" />
      <span>网络已断开，正在使用离线模式探索</span>
    </div>
  )
}