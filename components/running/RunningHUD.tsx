"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { Play, Pause, Square, Lock, Unlock, Zap, Flame, Map as MapIcon, Trophy, CheckCircle2, Settings, Cloud, CloudOff, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let url = input
    if (typeof url === 'string' && url.startsWith('/api')) {
      url = `${process.env.NEXT_PUBLIC_API_SERVER || ''}${url}`
    }
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchUserMissions = async () => {
  const res = await fetchWithTimeout('/api/mission/fetch-user-missions', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch missions')
  return await res.json()
}
import { RunningSettings } from "./RunningSettings"

// ----------------------------------------------------------------------------
// Sub-component: Mission Tracker
// ----------------------------------------------------------------------------
interface MissionTrackerItemProps {
  title: string
  current: number
  target: number
  unit: string
  isCompleted: boolean
}

function MissionTrackerItem({ title, current, target, unit, isCompleted }: MissionTrackerItemProps) {
  const progress = Math.min(100, (current / target) * 100)

  return (
    <div className="mb-3 w-full max-w-[260px] rounded-xl bg-black/60 backdrop-blur-md p-3 text-sm text-white border border-white/10 shadow-lg">
      <div className="flex justify-between items-center mb-2">
        <span className="truncate font-bold max-w-[160px] drop-shadow-sm">{title}</span>
        {isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-[#22c55e]" />
        ) : (
          <span className="text-white/80 font-mono font-bold">{Math.floor(current)}/{target}</span>
        )}
      </div>
      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden ring-1 ring-white/5">
        <motion.div
          className={cn("h-full rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]", isCompleted ? "bg-[#22c55e]" : "bg-blue-500")}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Sub-component: Animated Counter
// ----------------------------------------------------------------------------
function AnimatedCounter({ value, className, decimals = 2 }: { value: number, className?: string, decimals?: number }) {
  // Using Framer Motion's useSpring for smooth interpolation
  const springValue = useSpring(value, { stiffness: 50, damping: 15, mass: 1 })
  const displayValue = useTransform(springValue, (current) => current.toFixed(decimals))
  const [renderedValue, setRenderedValue] = useState(value.toFixed(decimals))

  useEffect(() => {
    const unsubscribe = displayValue.on("change", (latest) => {
      setRenderedValue(latest)
    })
    springValue.set(value)
    return () => unsubscribe()
  }, [value, springValue, displayValue, decimals])

  return (
    <span className={cn("tabular-nums tracking-tighter", className)}>
      {renderedValue}
    </span>
  )
}

interface RunningHUDProps {
  distance: number // km
  currentDistanceMeters?: number
  steps?: number
  duration: string // "HH:MM:SS"
  pace: string // "MM:SS"
  calories: number
  isPaused: boolean
  onResume: () => void
  onPause: () => void
  onStop: () => Promise<void> | void;
  onToggleMap?: () => void
  isMapExpanded?: boolean
  isSyncing?: boolean // New prop
  onGhostModeTrigger?: () => void
  hexesCaptured?: number
  onMapClick?: () => void // Deprecated but maybe passed
}

// ----------------------------------------------------------------------------
// Sub-component: Slide to Pause Button (New Design)
// ----------------------------------------------------------------------------
function SlideToPause({ onPause }: { onPause: () => void }) {
  const [dragX, setDragX] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const SLIDE_THRESHOLD = 150 // Reduced threshold for easier trigger
  const textOpacity = Math.max(0.12, 1 - (dragX / SLIDE_THRESHOLD) * 0.85)
  const textScale = Math.max(0.9, 1 - (dragX / SLIDE_THRESHOLD) * 0.08)

  return (
    <div className="relative w-full max-w-[280px] h-16 bg-[#22c55e] rounded-full overflow-hidden shadow-lg shadow-[#22c55e]/20 touch-none select-none z-[100]" ref={containerRef} style={{ WebkitTouchCallout: 'none' }}>
      {/* Background Text — z-10 ensures it's above track, pointer-events-none so it doesn't block the knob drag */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none text-black/60 text-sm font-bold tracking-widest z-10"
        style={{ opacity: textOpacity, transform: `scale(${textScale})` }}
      >
        {"> 滑动暂停"}
      </div>

      {/* Progress Overlay (Darken as we slide) */}
      <motion.div
        className="absolute inset-y-0 left-0 bg-black/10"
        style={{ width: dragX + 64 }}
      />

      {/* Draggable Knob — z-20 keeps it above the text layer */}
      <motion.div
        className="absolute top-1 left-1 bottom-1 w-14 bg-white rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-20"
        drag="x"
        dragConstraints={{ left: 0, right: SLIDE_THRESHOLD }}
        dragElastic={0.05} // Less elastic for more direct feel
        dragMomentum={false}
        onDrag={(event, info) => {
          setDragX(Math.max(0, info.point.x))
        }}
        onDragEnd={(event, info) => {
          // Trigger if passed threshold or dragged more than 80%
          if (info.point.x > SLIDE_THRESHOLD - 20) {
            if (onPause) onPause()
          }
          setDragX(0)
        }}
        whileTap={{ scale: 1.05 }}
      >
        <Pause className="h-6 w-6 text-[#22c55e] fill-current" />
      </motion.div>
    </div>
  )
}

export function RunningHUD({
  distance,
  currentDistanceMeters,
  steps = 0,
  duration,
  pace,
  calories,
  isPaused,
  onResume,
  onPause,
  onStop,
  onToggleMap,
  isMapExpanded,
  isSyncing = false
}: RunningHUDProps) {
  const [isLocked, setIsLocked] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const ghostTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showGhost, setShowGhost] = useState(false)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const lastStopClickRef = useRef<number>(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Long press pace to toggle ghost runner info
  const handlePacePressStart = () => {
    ghostTimerRef.current = setTimeout(() => {
      setShowGhost(prev => !prev)
      toast.info(showGhost ? "已隐藏配速对比" : "已显示配速对比")
    }, 800)
  }

  const handlePacePressEnd = () => {
    if (ghostTimerRef.current) {
      clearTimeout(ghostTimerRef.current)
      ghostTimerRef.current = null
    }
  }

  // --------------------------------------------------------------------------
  // Mission Tracking Logic
  // --------------------------------------------------------------------------
  const [activeMissions, setActiveMissions] = useState<any[]>([])
  const [completedMissionIds, setCompletedMissionIds] = useState<Set<string>>(new Set())
  const localDistanceMeters = currentDistanceMeters ?? distance * 1000
  const localDistanceKm = localDistanceMeters / 1000
  const avgStride = steps > 0 ? (localDistanceMeters / steps) : 0

  const getDistanceMissionProgress = useCallback((mission: any, userMission: any) => {
    const serverProgress = Number(userMission.current || 0)
    const isKmTarget = mission.target < 50
    const optimisticCurrent = serverProgress + (isKmTarget ? localDistanceKm : localDistanceMeters)
    const target = Number(mission.target || 0)
    return {
      current: optimisticCurrent,
      target,
      isCompleted: optimisticCurrent >= target && target > 0,
      unit: isKmTarget ? 'km' : 'm'
    }
  }, [localDistanceKm, localDistanceMeters])

  // 1. Fetch Missions on Mount
  useEffect(() => {
    console.log(`[Page] runner_page_mount | time: ${new Date().toISOString()}`);
    const loadMissions = async () => {
      try {
        const missions = await fetchUserMissions()
        // Filter: Active, Daily, Not Claimed
        // FIX: Ensure missions have frequency property or filter safely
        const dailyActive = missions.filter((m: any) => {
          // Handle both nested (m.missions.frequency) and flat (m.frequency) data shapes
          const freq = m.missions?.frequency ?? m.frequency;
          const isDailyOrUnset = !freq || freq === 'daily'; // show if frequency missing or daily
          return isDailyOrUnset && m.status !== 'claimed' && m.status !== 'completed';
        })
        setActiveMissions(dailyActive)
      } catch (err) {
        console.error("Failed to fetch missions for HUD", err)
      }
    }
    loadMissions()
  }, [])

  // 2. Track Progress & Notifications
  useEffect(() => {
    if (!activeMissions || activeMissions.length === 0) return

    activeMissions.forEach(um => {
      // FIX: Access nested mission data safely
      const mission = um.missions || um;
      if (!mission || completedMissionIds.has(mission.id)) return

      let isHit = false

      if (mission.type === 'DISTANCE_DAILY') {
        const progress = getDistanceMissionProgress(mission, um)
        isHit = progress.isCompleted
      }

      if (isHit) {
        toast.success(`任务完成: ${mission.title}`, {
          description: "太棒了！继续保持！",
          icon: <Trophy className="h-5 w-5 text-yellow-400" />
        })
        setCompletedMissionIds(prev => new Set(prev).add(mission.id))
      }
    })
  }, [activeMissions, completedMissionIds, getDistanceMissionProgress])

  return (
    <>
      <AnimatePresence>
        {!isMapExpanded && (
          <motion.div
            className="absolute inset-0 pointer-events-none flex flex-col justify-between z-40 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-[calc(env(safe-area-inset-top)+60px)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Top Info Bar */}
            <div className="pointer-events-auto px-6 w-full flex justify-between items-start">
              <div className="flex flex-col gap-2">
                {/* Connection Status */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md text-xs font-medium border shadow-sm transition-colors",
                  isOnline
                    ? (isSyncing ? "bg-blue-500/20 text-blue-200 border-blue-500/30" : "bg-black/30 text-white/50 border-white/10")
                    : "bg-red-500/20 text-red-200 border-red-500/30"
                )}>
                  {isOnline ? (
                    isSyncing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>同步中...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-3 h-3 opacity-70" />
                        <span>已同步</span>
                      </>
                    )
                  ) : (
                    <>
                      <CloudOff className="w-3 h-3" />
                      <span>离线模式 (已缓存)</span>
                    </>
                  )}
                </div>

                {activeMissions.slice(0, 2).map(um => {
                  const mission = um.missions || um;
                  const isDistanceMission = mission.type === 'DISTANCE_DAILY';
                  const distanceProgress = isDistanceMission ? getDistanceMissionProgress(mission, um) : null
                  
                  return (
                    <MissionTrackerItem
                      key={mission.id}
                      title={mission.title}
                      current={distanceProgress?.current || 0}
                      target={distanceProgress?.target || mission.target}
                      unit={distanceProgress?.unit || ''}
                      isCompleted={completedMissionIds.has(mission.id)}
                    />
                  )
                })}
              </div>

              {/* Top Right Buttons Removed as requested - moved to bottom */}
            </div>

            {/* Main Stats Display (Center) */}
            <div className="pointer-events-auto px-6 flex flex-col items-center justify-evenly flex-1 py-8">
              {/* Distance (Main) */}
              <div className="flex flex-col items-center">
                <AnimatedCounter value={distance} className="text-[6rem] font-black text-white leading-none drop-shadow-2xl italic" decimals={2} />
                <span className="text-white/60 font-bold tracking-widest uppercase mt-2 text-lg">公里</span>
              </div>

              {/* Secondary Stats Grid */}
              <div className="grid grid-cols-3 gap-8 w-full max-w-sm">
                <div
                  className="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
                  onTouchStart={handlePacePressStart}
                  onTouchEnd={handlePacePressEnd}
                  onMouseDown={handlePacePressStart}
                  onMouseUp={handlePacePressEnd}
                  onMouseLeave={handlePacePressEnd}
                >
                  <div className="flex items-center gap-1.5 text-white/60 mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">配速</span>
                  </div>
                  <span className="text-2xl font-black text-white font-mono">{pace}</span>
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-white/60 mb-1">
                    <Flame className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">千卡</span>
                  </div>
                  <AnimatedCounter value={calories} className="text-2xl font-black text-white font-mono" decimals={0} />
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-white/60 mb-1">
                    <Trophy className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">时长</span>
                  </div>
                  <span className="text-2xl font-black text-white font-mono">{duration}</span>
                </div>
              </div>
              <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-6">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-white/60 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">步数</span>
                  </div>
                  <span className="text-xl font-black text-white font-mono">{steps}</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1.5 text-white/60 mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider">步幅(m)</span>
                  </div>
                  <span className="text-xl font-black text-white font-mono">{avgStride > 0 ? avgStride.toFixed(2) : '--'}</span>
                </div>
              </div>
            </div>

            {/* Controls Bottom */}
            <div className="pointer-events-auto px-8 w-full flex flex-col items-center gap-6 mt-auto">

              {/* Action Buttons: Lock, Map, Settings */}
              <div className="flex items-center gap-6 mb-2">
                {/* Lock Button */}
                <button
                  onClick={() => setIsLocked(!isLocked)}
                  className={cn(
                    "h-12 w-12 rounded-full backdrop-blur-md flex items-center justify-center border active:scale-95 transition-all shadow-lg",
                    isLocked ? "bg-amber-500/80 text-white border-amber-400" : "bg-black/40 text-white border-white/10"
                  )}
                >
                  {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </button>

                {/* Map Button (Larger) */}
                {onToggleMap && (
                  <button
                    onClick={onToggleMap}
                    className="h-16 w-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/20 active:scale-95 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                  >
                    <MapIcon className="w-7 h-7" />
                  </button>
                )}

                {/* Settings Button */}
                <button
                  onClick={() => setShowSettings(true)}
                  className="h-12 w-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all shadow-lg"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>

              {!isLocked && (
                <div className="w-full flex justify-center items-center relative z-[100]">
                  {isPaused ? (
                    <div className="flex items-center gap-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
                      {/* Resume Button */}
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onResume}
                        className="h-20 w-20 rounded-full bg-[#22c55e] flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)] border-4 border-[#16a34a] text-white z-20"
                      >
                        <Play className="w-8 h-8 fill-current ml-1" />
                      </motion.button>

                      {/* Stop Button */}
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const now = Date.now();
                          if (now - lastStopClickRef.current < 2000) return;
                          lastStopClickRef.current = now;
                          try {
                            await onStop();
                          } catch (err) {
                            console.error("onStop failed in HUD:", err);
                          }
                        }}
                        className="h-20 w-20 rounded-full bg-[#ef4444] flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)] border-4 border-[#b91c1c] text-white z-20 pointer-events-auto"
                      >
                        <Square className="w-8 h-8 fill-current" />
                      </motion.button>
                    </div>
                  ) : (
                    /* Slide to Pause */
                    <SlideToPause onPause={onPause} />
                  )}
                </div>
              )}

              {isLocked && (
                <div className="w-full text-center flex justify-center text-white/40 text-sm font-medium animate-pulse">
                  屏幕已锁定 · 点击锁图标解锁
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RunningSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}
