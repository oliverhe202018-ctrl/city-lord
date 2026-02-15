"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { Play, Pause, Square, Lock, Unlock, Zap, Flame, Map as MapIcon, Trophy, CheckCircle2, Settings, Cloud, CloudOff, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
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
  duration: string // "HH:MM:SS"
  pace: string // "MM:SS"
  calories: number
  isPaused: boolean
  onResume: () => void
  onPause: () => void
  onStop: () => void
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

  return (
    <div className="relative w-full max-w-[280px] h-16 bg-[#22c55e] rounded-full overflow-hidden shadow-lg shadow-[#22c55e]/20 touch-none select-none" ref={containerRef} style={{ WebkitTouchCallout: 'none' }}>
      {/* Background Text */}
      <div className="absolute inset-0 flex items-center justify-center text-black/60 text-sm font-bold pointer-events-none tracking-widest pl-12 animate-pulse">
        {"> 滑动暂停"}
      </div>

      {/* Progress Overlay (Darken as we slide) */}
      <motion.div 
        className="absolute inset-y-0 left-0 bg-black/10" 
        style={{ width: dragX + 64 }} 
      />

      {/* Draggable Knob */}
      <motion.div
        className="absolute top-1 left-1 bottom-1 w-14 bg-white rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-10"
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

  // 1. Fetch Missions on Mount
  useEffect(() => {
    const loadMissions = async () => {
      try {
        const missions = await fetchUserMissions()
        // Filter: Active, Daily, Not Claimed
        // FIX: Ensure missions have frequency property or filter safely
        const dailyActive = missions.filter(m => 
          m.missions?.frequency === 'daily' && // Access nested relation if necessary or check type
          m.status !== 'claimed' &&
          m.status !== 'completed'
        )
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

      let currentProgress = um.current || 0 // Use user_mission progress if available
      let isHit = false

      if (mission.type === 'DISTANCE_DAILY') {
        // Server usually stores meters. HUD distance is KM.
        // Check if target is likely meters (e.g. 1000, 5000) or km (1, 5)
        // Based on seed: 'Run 1km' -> target 1 (if code assumes km) or 1000 (if meters).
        // Let's assume target is KM for simplicity if small, or meters if large.
        // Or safer: use mission definition.
        // For now, simple heuristic:
        const target = mission.target
        const current = distance * 1000 // meters
        if (target < 50) { // likely KM
            if (distance >= target) isHit = true
        } else {
            if (current >= target) isHit = true
        }
        currentProgress = distance
      }

      if (isHit) {
        toast.success(`任务完成: ${mission.title}`, {
          description: "太棒了！继续保持！",
          icon: <Trophy className="h-5 w-5 text-yellow-400" />
        })
        setCompletedMissionIds(prev => new Set(prev).add(mission.id))
      }
    })
  }, [distance, activeMissions, completedMissionIds])

  return (
    <>
    <AnimatePresence>
      {!isMapExpanded && (
        <motion.div 
          className="absolute inset-0 pointer-events-none flex flex-col justify-between z-40 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-[calc(env(safe-area-inset-top)+60px)]"
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
                  return (
                  <MissionTrackerItem 
                    key={mission.id}
                    title={mission.title}
                    current={mission.type === 'DISTANCE_DAILY' ? (mission.target < 50 ? distance : distance * 1000) : 0}
                    target={mission.target}
                    unit={mission.type === 'DISTANCE_DAILY' ? (mission.target < 50 ? 'km' : 'm') : ''}
                    isCompleted={completedMissionIds.has(mission.id)}
                  />
                 )})}
             </div>
             
             <div className="flex flex-col gap-3">
                 <button 
                   onClick={() => setShowSettings(true)}
                   className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all shadow-lg"
                 >
                    <Settings className="w-5 h-5" />
                 </button>
                 {onToggleMap && (
                   <button 
                     onClick={onToggleMap}
                     className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white border border-white/10 active:scale-95 transition-all shadow-lg"
                   >
                      <MapIcon className="w-5 h-5" />
                   </button>
                 )}
                 <button 
                   onClick={() => setIsLocked(!isLocked)}
                   className={cn(
                     "h-10 w-10 rounded-full backdrop-blur-md flex items-center justify-center border active:scale-95 transition-all shadow-lg",
                     isLocked ? "bg-amber-500/80 text-white border-amber-400" : "bg-black/40 text-white border-white/10"
                   )}
                 >
                    {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                 </button>
             </div>
          </div>

          {/* Main Stats Display (Center) */}
          <div className="pointer-events-auto px-6 flex flex-col items-center justify-center flex-1 gap-8">
              {/* Distance (Main) */}
              <div className="flex flex-col items-center">
                  <AnimatedCounter value={distance} className="text-[6rem] font-black text-white leading-none drop-shadow-2xl italic" decimals={2} />
                  <span className="text-white/60 font-bold tracking-widest uppercase mt-2 text-lg">Kilometers</span>
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
                          <span className="text-xs font-bold uppercase tracking-wider">Pace</span>
                      </div>
                      <span className="text-2xl font-black text-white font-mono">{pace}</span>
                  </div>

                  <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1.5 text-white/60 mb-1">
                          <Flame className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Kcal</span>
                      </div>
                      <AnimatedCounter value={calories} className="text-2xl font-black text-white font-mono" decimals={0} />
                  </div>

                  <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1.5 text-white/60 mb-1">
                          <Trophy className="w-4 h-4" />
                          <span className="text-xs font-bold uppercase tracking-wider">Time</span>
                      </div>
                      <span className="text-2xl font-black text-white font-mono">{duration}</span>
                  </div>
              </div>
          </div>

          {/* Controls Bottom */}
          <div className="pointer-events-auto px-8 w-full flex flex-col items-center gap-6 mb-8">
             
             {!isLocked && (
                 <div className="w-full flex justify-center items-center">
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

                             {/* Stop Button (Long Press handled in parent?) or simple click */}
                             <motion.button
                               whileTap={{ scale: 0.9 }}
                               onClick={onStop}
                               className="h-20 w-20 rounded-full bg-[#ef4444] flex items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.4)] border-4 border-[#b91c1c] text-white z-20"
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
                 <div className="text-white/40 text-sm font-medium animate-pulse">
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
