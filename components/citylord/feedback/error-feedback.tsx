"use client"

import React from "react"

import { useState, useEffect } from "react"
import { 
  WifiOff, 
  MapPinOff, 
  AlertTriangle, 
  RefreshCw,
  Settings,
  X,
  Signal,
  SignalLow,
  SignalMedium,
  Loader2
} from "lucide-react"

// ============================================================
// 1. GPS Signal Weak Popup
// ============================================================

interface GpsWeakPopupProps {
  isOpen: boolean
  onClose: () => void
  onRetry: () => void
  signalStrength: number // 0-5
}

export function GpsWeakPopup({ isOpen, onClose, onRetry, signalStrength }: GpsWeakPopupProps) {
  const [isRetrying, setIsRetrying] = useState(false)

  if (!isOpen) return null

  const handleRetry = async () => {
    setIsRetrying(true)
    await onRetry()
    setTimeout(() => setIsRetrying(false), 2000)
  }

  const getSignalIcon = () => {
    if (signalStrength === 0) return <SignalLow className="h-8 w-8 text-red-400" />
    if (signalStrength <= 2) return <SignalMedium className="h-8 w-8 text-yellow-400" />
    return <Signal className="h-8 w-8 text-[#22c55e]" />
  }

  const getSignalText = () => {
    if (signalStrength === 0) return "无信号"
    if (signalStrength <= 2) return "信号弱"
    return "信号正常"
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="mx-4 w-full max-w-sm overflow-hidden rounded-3xl border border-yellow-500/30 bg-[#0f172a] shadow-[0_0_50px_rgba(234,179,8,0.2)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with animation */}
        <div className="relative bg-gradient-to-b from-yellow-500/20 to-transparent p-6 text-center">
          {/* Animated signal waves */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 animate-ping rounded-full bg-yellow-500/10" style={{ animationDuration: '2s' }} />
          </div>
          
          <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/20">
            {isRetrying ? (
              <Loader2 className="h-10 w-10 animate-spin text-yellow-400" />
            ) : (
              <MapPinOff className="h-10 w-10 text-yellow-400" />
            )}
          </div>
          
          <h2 className="text-xl font-bold text-white">GPS 信号弱</h2>
          <p className="mt-1 text-sm text-white/60">定位精度可能受到影响</p>
        </div>

        {/* Signal indicator */}
        <div className="border-y border-white/10 bg-white/5 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">当前信号强度</span>
            <div className="flex items-center gap-2">
              {getSignalIcon()}
              <span className={`text-sm font-medium ${
                signalStrength === 0 ? "text-red-400" : 
                signalStrength <= 2 ? "text-yellow-400" : "text-[#22c55e]"
              }`}>
                {getSignalText()}
              </span>
            </div>
          </div>
          
          {/* Signal bars */}
          <div className="mt-3 flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <div
                key={level}
                className={`h-2 flex-1 rounded-full transition-all ${
                  level <= signalStrength
                    ? level <= 2 ? "bg-red-400" : level <= 3 ? "bg-yellow-400" : "bg-[#22c55e]"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tips */}
        <div className="px-6 py-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-white/40">建议操作</p>
          <ul className="space-y-2 text-sm text-white/60">
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              移动到开阔地带获取更好的信号
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              确保手机定位服务已开启
            </li>
            <li className="flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              等待几秒钟让GPS重新校准
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10"
          >
            稍后再说
          </button>
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-yellow-500 py-3 text-sm font-semibold text-black transition-all hover:bg-yellow-400 disabled:opacity-50"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            重新定位
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 2. Network Disconnected Banner
// ============================================================

interface NetworkBannerProps {
  isOffline: boolean
  onRetry?: () => void
}

export function NetworkBanner({ isOffline, onRetry }: NetworkBannerProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (isOffline) {
      setShowBanner(true)
    } else {
      // Delay hiding to show "reconnected" message
      const timer = setTimeout(() => setShowBanner(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isOffline])

  if (!showBanner && !isOffline) return null

  const handleRetry = async () => {
    setIsRetrying(true)
    onRetry?.()
    setTimeout(() => setIsRetrying(false), 2000)
  }

  return (
    <div 
      className={`fixed left-0 right-0 top-0 z-40 transition-all duration-300 ${
        showBanner ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      <div 
        className={`flex items-center justify-between px-4 py-3 ${
          isOffline 
            ? "bg-red-500/90 backdrop-blur-sm" 
            : "bg-[#22c55e]/90 backdrop-blur-sm"
        }`}
      >
        <div className="flex items-center gap-3">
          {isOffline ? (
            <>
              <WifiOff className="h-5 w-5 text-white" />
              <div>
                <p className="text-sm font-medium text-white">网络连接已断开</p>
                <p className="text-xs text-white/70">跑步数据将在恢复后同步</p>
              </div>
            </>
          ) : (
            <>
              <Signal className="h-5 w-5 text-white" />
              <p className="text-sm font-medium text-white">网络已恢复连接</p>
            </>
          )}
        </div>
        
        {isOffline && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30"
          >
            {isRetrying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            重试
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 3. Location Permission Prompt
// ============================================================

interface LocationPermissionPromptProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings: () => void
}

export function LocationPermissionPrompt({ isOpen, onClose, onOpenSettings }: LocationPermissionPromptProps) {
  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="mx-4 w-full max-w-sm overflow-hidden rounded-3xl border border-[#22c55e]/30 bg-[#0f172a]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-b from-[#22c55e]/20 to-transparent p-6 text-center">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white/60 hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#22c55e]/20">
            <MapPinOff className="h-10 w-10 text-[#22c55e]" />
          </div>
          
          <h2 className="text-xl font-bold text-white">需要定位权限</h2>
          <p className="mt-1 text-sm text-white/60">开启定位以追踪你的跑步路线</p>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="mb-3 text-sm font-medium text-white">CityLord 需要访问你的位置来：</p>
            <ul className="space-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                追踪跑步路线和距离
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                计算领地占领范围
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                显示附近的好友和领地
              </li>
            </ul>
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-yellow-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
            <p className="text-xs text-yellow-400/80">
              未开启定位权限将无法使用跑步占领功能，但你仍可浏览排行榜和任务。
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 p-6 pt-2">
          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#22c55e] py-3.5 font-semibold text-black transition-all hover:bg-[#22c55e]/90 active:scale-[0.98]"
          >
            <Settings className="h-5 w-5" />
            前往设置开启
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10"
          >
            暂不开启
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 4. Data Load Failed Card
// ============================================================

interface DataLoadFailedCardProps {
  title?: string
  message?: string
  onRetry: () => void
  isRetrying?: boolean
}

export function DataLoadFailedCard({ 
  title = "加载失败", 
  message = "无法加载数据，请检查网络后重试",
  onRetry,
  isRetrying = false
}: DataLoadFailedCardProps) {
  return (
    <div className="mx-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20">
        <AlertTriangle className="h-8 w-8 text-red-400" />
      </div>
      
      <h3 className="mb-1 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-4 text-sm text-white/50">{message}</p>
      
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/20 py-3 text-sm font-medium text-red-400 transition-all hover:bg-red-500/30 disabled:opacity-50"
      >
        {isRetrying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            正在重试...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4" />
            重新加载
          </>
        )}
      </button>
    </div>
  )
}

// ============================================================
// 5. Loading Skeleton Components
// ============================================================

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/10 ${className}`} />
  )
}

export function CardLoadingSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <LoadingSkeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton className="h-4 w-3/4" />
          <LoadingSkeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function ListLoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardLoadingSkeleton key={i} />
      ))}
    </div>
  )
}

// ============================================================
// 6. Button States Demo Component
// ============================================================

type ButtonState = "idle" | "active" | "loading" | "disabled" | "success" | "error"

interface StatefulButtonProps {
  state: ButtonState
  onClick?: () => void
  children: React.ReactNode
  variant?: "primary" | "secondary" | "danger"
  className?: string
}

export function StatefulButton({ 
  state, 
  onClick, 
  children, 
  variant = "primary",
  className = "" 
}: StatefulButtonProps) {
  const baseStyles = "flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-semibold transition-all"
  
  const variantStyles = {
    primary: {
      idle: "bg-[#22c55e] text-black hover:bg-[#22c55e]/90 active:scale-[0.98]",
      active: "bg-[#22c55e] text-black ring-4 ring-[#22c55e]/30",
      loading: "bg-[#22c55e]/50 text-black/70 cursor-wait",
      disabled: "bg-white/10 text-white/30 cursor-not-allowed",
      success: "bg-[#22c55e] text-black",
      error: "bg-red-500 text-white",
    },
    secondary: {
      idle: "bg-white/10 text-white hover:bg-white/20 active:scale-[0.98]",
      active: "bg-white/20 text-white ring-4 ring-white/20",
      loading: "bg-white/5 text-white/50 cursor-wait",
      disabled: "bg-white/5 text-white/20 cursor-not-allowed",
      success: "bg-[#22c55e]/20 text-[#22c55e]",
      error: "bg-red-500/20 text-red-400",
    },
    danger: {
      idle: "bg-red-500 text-white hover:bg-red-400 active:scale-[0.98]",
      active: "bg-red-500 text-white ring-4 ring-red-500/30",
      loading: "bg-red-500/50 text-white/70 cursor-wait",
      disabled: "bg-white/10 text-white/30 cursor-not-allowed",
      success: "bg-[#22c55e] text-black",
      error: "bg-red-600 text-white",
    },
  }

  const isDisabled = state === "disabled" || state === "loading"

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant][state]} ${className}`}
    >
      {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

// ============================================================
// 7. Error Feedback Demo Page (for testing)
// ============================================================

export function ErrorFeedbackDemo() {
  const [showGpsPopup, setShowGpsPopup] = useState(false)
  const [showPermission, setShowPermission] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const [showLoadFailed, setShowLoadFailed] = useState(false)
  const [buttonState, setButtonState] = useState<ButtonState>("idle")

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-bold text-white">错误反馈演示</h2>
      
      {/* Trigger buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowGpsPopup(true)}
          className="rounded-xl bg-yellow-500/20 p-3 text-sm text-yellow-400"
        >
          GPS信号弱
        </button>
        <button
          onClick={() => setShowPermission(true)}
          className="rounded-xl bg-[#22c55e]/20 p-3 text-sm text-[#22c55e]"
        >
          定位权限
        </button>
        <button
          onClick={() => setIsOffline(!isOffline)}
          className="rounded-xl bg-red-500/20 p-3 text-sm text-red-400"
        >
          {isOffline ? "恢复网络" : "断开网络"}
        </button>
        <button
          onClick={() => setShowLoadFailed(!showLoadFailed)}
          className="rounded-xl bg-white/10 p-3 text-sm text-white/60"
        >
          加载失败
        </button>
      </div>

      {/* Button states demo */}
      <div className="space-y-2">
        <p className="text-sm text-white/60">按钮状态演示：</p>
        <div className="flex flex-wrap gap-2">
          {(["idle", "active", "loading", "disabled", "success", "error"] as ButtonState[]).map((s) => (
            <button
              key={s}
              onClick={() => setButtonState(s)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                buttonState === s ? "bg-white/20 text-white" : "bg-white/5 text-white/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <StatefulButton state={buttonState} onClick={() => {}}>
          示例按钮
        </StatefulButton>
      </div>

      {/* Load failed card */}
      {showLoadFailed && (
        <DataLoadFailedCard 
          onRetry={() => setShowLoadFailed(false)} 
        />
      )}

      {/* Popups */}
      <GpsWeakPopup
        isOpen={showGpsPopup}
        onClose={() => setShowGpsPopup(false)}
        onRetry={() => Promise.resolve()}
        signalStrength={1}
      />

      <LocationPermissionPrompt
        isOpen={showPermission}
        onClose={() => setShowPermission(false)}
        onOpenSettings={() => setShowPermission(false)}
      />

      <NetworkBanner isOffline={isOffline} onRetry={() => setIsOffline(false)} />
    </div>
  )
}
