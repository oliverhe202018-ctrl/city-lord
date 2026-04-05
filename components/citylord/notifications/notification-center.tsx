"use client"

import React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/useAuth"
import { useGameStore } from "@/store/useGameStore"
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import {
  X,
  Trophy,
  Swords,
  Zap,
  Users,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Gift,
  ChevronRight,
  Calendar,
} from "lucide-react"

type NotificationType = "achievement" | "battle" | "challenge" | "friend" | "reward" | "system" | "activity"

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
  action?: {
    label: string
    handler: () => void
  }
}

const notificationConfig: Record<NotificationType, {
  icon: React.ElementType
  color: string
  bg: string
}> = {
  achievement: { icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-400/20" },
  battle: { icon: Swords, color: "text-red-400", bg: "bg-red-400/20" },
  challenge: { icon: Zap, color: "text-cyan-400", bg: "bg-cyan-400/20" },
  friend: { icon: Users, color: "text-purple-400", bg: "bg-purple-400/20" },
  reward: { icon: Gift, color: "text-[#22c55e]", bg: "bg-[#22c55e]/20" },
  system: { icon: Bell, color: "text-white/60", bg: "bg-white/10" },
  activity: { icon: Calendar, color: "text-orange-400", bg: "bg-orange-400/20" },
}

// Toast Notification
interface ToastNotificationProps {
  notification: Notification
  onClose: () => void
  onAction?: () => void
}

export function ToastNotification({
  notification,
  onClose,
  onAction,
}: ToastNotificationProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose()
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(onClose, 300)
  }

  const config = notificationConfig[notification.type]
  const Icon = config.icon

  return (
    <div
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ${isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
        }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`shrink-0 rounded-xl ${config.bg} p-2.5`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white">{notification.title}</h4>
            <p className="mt-0.5 text-sm text-white/60 line-clamp-2">
              {notification.message}
            </p>
            {notification.action && (
              <button
                onClick={() => {
                  onAction?.()
                  notification.action?.handler()
                  handleClose()
                }}
                className={`mt-2 flex items-center gap-1 text-sm font-medium ${config.color} hover:underline`}
              >
                {notification.action.label}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <button
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Notification List Panel
interface NotificationPanelProps {
  notifications: Notification[]
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  onClearAll?: () => void
}

export function NotificationPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length
  const [isPushEnabled, setIsPushEnabled] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setIsPushEnabled(!!sub)
        }).catch(console.error)
      }).catch(console.error)
    }
  }, [])

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('当前浏览器不支持推送通知')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        alert('推送权限被拒绝')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('Missing VAPID public key')
        return
      }
      // base64 to Uint8Array conversion for VAPID key
      const padding = '='.repeat((4 - vapidKey.length % 4) % 4)
      const base64 = (vapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/')
      const rawData = window.atob(base64)
      const outputArray = new Uint8Array(rawData.length)
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray
      })

      const res = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub)
      })

      if (res.ok) {
        setIsPushEnabled(true)
      }
    } catch (error) {
      console.error('Failed to subscribe:', error)
    }
  }

  return (
    <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/95 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-white/60" />
          <h3 className="font-semibold text-white">通知</h3>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {!isPushEnabled && (
            <button
              onClick={subscribeToPush}
              className="text-xs text-orange-400 hover:text-orange-300 hover:underline mr-2 flex items-center gap-1"
            >
              <Zap className="h-3 w-3" /> 开启活动提醒
            </button>
          )}
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-[#22c55e] hover:underline"
            >
              全部已读
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-white/50 hover:text-white hover:underline"
            >
              清空
            </button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="mb-3 h-10 w-10 text-white/20" />
            <p className="text-white/60">暂无通知</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {notifications.map((notification) => {
              const config = notificationConfig[notification.type]
              const Icon = config.icon
              return (
                <div
                  key={notification.id}
                  onClick={() => onMarkRead?.(notification.id)}
                  className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-white/5 cursor-pointer ${!notification.read ? "bg-white/[0.02]" : ""
                    }`}
                >
                  <div className={`shrink-0 rounded-xl ${config.bg} p-2`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`font-medium ${notification.read ? "text-white/70" : "text-white"
                          }`}
                      >
                        {notification.title}
                      </h4>
                      {!notification.read && (
                        <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-white/50 line-clamp-1">
                      {notification.message}
                    </p>
                    <p className="mt-1 text-xs text-white/30">
                      {notification.timestamp}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// Friend Online Status Popup
interface FriendOnlinePopupProps {
  friend: {
    name: string
    avatar?: string
    level: number
  }
  onClose: () => void
  onViewProfile?: () => void
}

export function FriendOnlinePopup({
  friend,
  onClose,
  onViewProfile,
}: FriendOnlinePopupProps) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose()
    }, 4000)
    return () => clearTimeout(timer)
  }, [])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(onClose, 300)
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#22c55e]/30 bg-black/90 p-3 pr-4 shadow-xl backdrop-blur-xl transition-all duration-300 ${isExiting ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        }`}
    >
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#22c55e]/20 text-lg font-bold text-[#22c55e]">
          {friend.avatar || friend.name.charAt(0)}
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-black bg-[#22c55e]" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-white">{friend.name}</p>
        <p className="text-xs text-[#22c55e]">刚刚上线</p>
      </div>
      <button
        onClick={() => {
          onViewProfile?.()
          handleClose()
        }}
        className="rounded-lg bg-[#22c55e]/20 px-3 py-1.5 text-xs font-medium text-[#22c55e] hover:bg-[#22c55e]/30"
      >
        查看
      </button>
    </div>
  )
}

// Notification Context
interface NotificationContextType {
  notifications: Notification[]
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "read">) => void
  removeNotification: (id: string) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  clearAll: () => void
}

const NotificationContext = createContext<NotificationContextType | null>(null)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [toasts, setToasts] = useState<Notification[]>([])
  const { user } = useAuth()
  const supabase = createClient()

  // Fetch Notifications on Mount
  useEffect(() => {
    if (!user?.id) return

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (data && !error) {
        setNotifications(data.map(n => ({
          id: n.id,
          type: (n.type as NotificationType) || 'system',
          title: n.title,
          message: n.body || '',
          timestamp: n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: zhCN }) : '刚刚',
          read: n.is_read || false,
          action: (n.data as any)?.territoryId ? {
            label: "查看",
            handler: () => { } // Logic to navigate
          } : undefined
        })))
      }
    }

    fetchNotifications()

    // Realtime Subscription
    const channel = supabase.channel('notification-provider')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        const n = payload.new
        const newNotif: Notification = {
          id: n.id,
          type: (n.type as NotificationType) || 'system',
          title: n.title,
          message: n.body || '',
          timestamp: '刚刚',
          read: false,
          action: (n.data as any)?.territoryId ? {
            label: "查看",
            handler: () => { }
          } : undefined
        }

        setNotifications(prev => [newNotif, ...prev])
        setToasts(prev => [...prev, newNotif])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  const addNotification = (
    notification: Omit<Notification, "id" | "timestamp" | "read">
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: "刚刚",
      read: false,
    }
    setNotifications((prev) => [newNotification, ...prev])
    setToasts((prev) => [...prev, newNotification])
  }

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const markAsRead = async (id: string) => {
    const wasUnread = notifications.find(n => n.id === id && !n.read)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    if (user?.id) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      if (wasUnread) {
        const { unreadNotificationCount, setUnreadNotificationCount } = useGameStore.getState()
        setUnreadNotificationCount(Math.max(0, unreadNotificationCount - 1))
      }
    }
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    if (user?.id && unreadIds.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
      const { unreadNotificationCount, setUnreadNotificationCount } = useGameStore.getState()
      setUnreadNotificationCount(Math.max(0, unreadNotificationCount - unreadIds.length))
    }
  }

  const clearAll = async () => {
    const unreadCount = notifications.filter(n => !n.read).length
    setNotifications([])
    if (user?.id) {
      await supabase.from('notifications').delete().eq('user_id', user.id)
      const { unreadNotificationCount, setUnreadNotificationCount } = useGameStore.getState()
      setUnreadNotificationCount(Math.max(0, unreadNotificationCount - unreadCount))
    }
  }

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        removeNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
      }}
    >
      {children}

      {/* Toast Container */}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastNotification
            key={toast.id}
            notification={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider")
  }
  return context
}
