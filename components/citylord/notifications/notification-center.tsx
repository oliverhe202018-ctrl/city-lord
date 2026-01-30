"use client"

import React from "react"

import { useState, useEffect, createContext, useContext } from "react"
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
} from "lucide-react"

type NotificationType = "achievement" | "battle" | "challenge" | "friend" | "reward" | "system"

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
      className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
        isExiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
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
        <div className="flex gap-2">
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
                  className={`flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-white/5 cursor-pointer ${
                    !notification.read ? "bg-white/[0.02]" : ""
                  }`}
                >
                  <div className={`shrink-0 rounded-xl ${config.bg} p-2`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`font-medium ${
                          notification.read ? "text-white/70" : "text-white"
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
      className={`pointer-events-auto flex items-center gap-3 rounded-2xl border border-[#22c55e]/30 bg-black/90 p-3 pr-4 shadow-xl backdrop-blur-xl transition-all duration-300 ${
        isExiting ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
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

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const clearAll = () => {
    setNotifications([])
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

// Sample notifications for demo
export const sampleNotifications: Notification[] = Array.from({ length: 5 }, (_, i) => {
  const types: NotificationType[] = ["battle", "achievement", "challenge", "friend", "reward", "system"]
  const type = types[i % types.length]
  const timeAgo = i === 0 ? "刚刚" : `${i * 5 + Math.floor(Math.random() * 5)}分钟前`
  
  const titles = {
    battle: "领地争夺战报",
    achievement: "解锁新成就",
    challenge: "收到挑战邀请",
    friend: "好友动态",
    reward: "系统奖励",
    system: "系统公告"
  }

  const messages = {
    battle: `你在 ${["中央广场", "科技园", "滨海公园", "体育中心"][i % 4]} 的领地遭遇攻击`,
    achievement: `恭喜达成里程碑：累计跑步 ${10 + i * 5} 公里`,
    challenge: `跑者 Player_${1000 + i} 向你发起了竞速挑战`,
    friend: `你的好友 Runner_${200 + i} 刚刚完成了一次 5km 跑`,
    reward: `完成每日任务，获得 ${50 + i * 10} 金币`,
    system: "服务器将于今晚进行例行维护"
  }

  return {
    id: `${i + 1}`,
    type,
    title: titles[type],
    message: messages[type],
    timestamp: timeAgo,
    read: i > 4, // 前5条未读
    action: type === "challenge" || type === "battle" ? { 
      label: type === "challenge" ? "查看" : "反击", 
      handler: () => {} 
    } : undefined,
  }
})
