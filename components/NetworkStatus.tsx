'use client'
import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { toast } from 'sonner'

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)

    // Initial check with delay to prevent false positives on load
    const timer = setTimeout(() => {
      if (typeof navigator !== 'undefined') {
        setIsOnline(navigator.onLine)
      }
    }, 2000)

    const handleOnline = () => {
      setIsOnline(true)
      toast.success("网络已恢复", {
        icon: <Wifi className="w-4 h-4" />,
        duration: 3000,
      })
    }

    const handleOffline = () => {
      setIsOnline(false)
      toast.error("网络连接断开", {
        icon: <WifiOff className="w-4 h-4" />,
        duration: 3000,
      })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (!hasMounted || isOnline) return null

  return (
    <div className="fixed top-0 left-0 w-full bg-destructive/90 backdrop-blur-md text-destructive-foreground text-center text-[10px] sm:text-xs font-semibold py-1 z-[9999] animate-in slide-in-from-top flex items-center justify-center gap-2 shadow-lg pt-[env(safe-area-inset-top)] border-b border-white/10">
      <WifiOff className="w-3 h-3" />
      <span>当前网络不稳定，部分功能可能无法使用</span>
    </div>
  )
}