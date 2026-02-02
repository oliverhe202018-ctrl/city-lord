"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { Play, Pause, Square, Lock, Unlock, Zap, Flame, Map as MapIcon, Trophy, CheckCircle2, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { fetchUserMissions } from "@/app/actions/mission"
import { toast } from "sonner"
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
    <div className="mb-2 w-full max-w-[200px] rounded-lg bg-black/40 backdrop-blur-sm p-2 text-xs text-white border border-white/10">
      <div className="flex justify-between items-center mb-1">
        <span className="truncate font-medium max-w-[120px]">{title}</span>
        {isCompleted ? (
          <CheckCircle2 className="h-3 w-3 text-[#22c55e]" />
        ) : (
          <span className="text-white/60">{Math.floor(current)}/{target}</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div 
          className={cn("h-full rounded-full", isCompleted ? "bg-[#22c55e]" : "bg-blue-500")}
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

// ----------------------------------------------------------------------------
// Sub-component: Slide to Pause Button (New Design)
// ----------------------------------------------------------------------------
function SlideToPause({ onPause }: { onPause: () => void }) {
  const [dragX, setDragX] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const SLIDE_THRESHOLD = 200 // pixels to slide to trigger action

  return (
    <div className="relative w-full max-w-[320px] h-14 bg-[#22c55e] rounded-full overflow-hidden shadow-lg shadow-[#22c55e]/20" ref={containerRef}>
      {/* Background Text */}
      <div className="absolute inset-0 flex items-center justify-center text-black/60 text-sm font-bold pointer-events-none tracking-widest pl-8">
        {"> 向右滑动暂停"}
      </div>

      {/* Progress Overlay (Darken as we slide) */}
      <motion.div 
        className="absolute inset-y-0 left-0 bg-black/10" 
        style={{ width: dragX + 48 }} 
      />

      {/* Draggable Knob */}
      <motion.div
        className="absolute top-1 left-1 bottom-1 w-12 bg-white rounded-full flex items-center justify-center shadow-md cursor-grab active:cursor-grabbing z-10"
        drag="x"
        dragConstraints={{ left: 0, right: SLIDE_THRESHOLD }}
        dragElastic={0.1}
        dragMomentum={false}
        onDrag={(event, info) => {
          setDragX(info.point.x)
        }}
        onDragEnd={(event, info) => {
          if (info.offset.x > SLIDE_THRESHOLD - 50) {
            onPause()
          }
          setDragX(0)
        }}
        animate={{ x: 0 }} // Snap back
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <Pause size={20} className="text-[#22c55e] fill-current" />
      </motion.div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Sub-component: Paused Controls (Split Buttons)
// ----------------------------------------------------------------------------
function PausedControls({ onResume, onFinish }: { onResume: () => void, onFinish: () => void }) {
  const [confirmFinish, setConfirmFinish] = useState(false)

  const handleFinishClick = () => {
    if (!confirmFinish) {
      setConfirmFinish(true)
      toast.error("再次点击结束跑步", { duration: 2000 })
      setTimeout(() => setConfirmFinish(false), 2000)
    } else {
      onFinish()
    }
  }

  return (
    <div className="flex w-full max-w-[320px] h-14 gap-3">
      {/* Finish Button (Left 2/5) */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={handleFinishClick}
        className={cn(
          "flex-[2] rounded-full flex items-center justify-center font-bold text-white shadow-lg transition-all active:scale-95",
          confirmFinish ? "bg-red-600" : "bg-red-500"
        )}
      >
        {confirmFinish ? "确认结束" : "结束"}
      </motion.button>

      {/* Resume Button (Right 3/5) */}
      <motion.button
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onResume}
        className="flex-[3] bg-[#22c55e] rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-[#22c55e]/20 transition-all active:scale-95"
      >
        继续运动
      </motion.button>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Main Component: RunningHUD
// ----------------------------------------------------------------------------
interface RunningHUDProps {
  distance: number // km
  pace: string // "6:42"
  duration: string // "00:12:34"
  calories: number
  hexesCaptured: number
  isPaused: boolean
  onPauseToggle: () => void
  onStop: () => void
}

export function RunningHUD({
  distance,
  pace,
  duration,
  calories,
  hexesCaptured,
  isPaused,
  onPauseToggle,
  onStop
}: RunningHUDProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isMapMode, setIsMapMode] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [showUnlockHint, setShowUnlockHint] = useState(false)

  // Handle Unlock (Long Press or Slide)
  const unlockTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  const handleLockPressStart = () => {
    if (!isLocked) {
      setIsLocked(true)
      toast.info("屏幕已锁定", { duration: 2000, icon: <Lock className="w-4 h-4" /> })
    }
  }

  const handleUnlockPressStart = () => {
    setShowUnlockHint(true)
    unlockTimerRef.current = setTimeout(() => {
      setIsLocked(false)
      setShowUnlockHint(false)
      toast.success("屏幕已解锁", { duration: 2000, icon: <Unlock className="w-4 h-4" /> })
    }, 1500) // 1.5s long press to unlock
  }

  const handleUnlockPressEnd = () => {
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current)
      unlockTimerRef.current = null
      setShowUnlockHint(false)
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
        const dailyActive = missions.filter(m => 
          m.frequency === 'daily' && 
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
    if (activeMissions.length === 0) return

    activeMissions.forEach(mission => {
      if (completedMissionIds.has(mission.id)) return

      let currentProgress = mission.current || 0
      let isHit = false

      if (mission.type === 'DISTANCE_DAILY') {
        // Server usually stores meters. HUD distance is KM.
        // Check if target is likely meters (e.g. 1000, 5000) or km (1, 5)
        // Based on seed: 'Run 1km' -> target 1 (if code assumes km) or 1000 (if meters).
        // Let's look at seed.sql: ('Run 1km', ..., 1, ...). So target is 1 KM?
        // Wait, mission-checker.ts converts context.distance * 1000. So it assumes target is METERS?
        // Let's re-read seed.sql from tool result 1: 
        // "VALUES ('Morning Jog', 'Run 1km', 'distance', 1, ...)"
        // If mission-checker multiplies by 1000, then 1km * 1000 = 1000. 1000 >= 1. Yes.
        // BUT if target is 1, then running 0.001km (1 meter) completes it?
        // It seems inconsistent. 
        // IF seed target is 1 (meaning 1km?), but checker uses meters...
        // Let's assume target is consistent with how checker works. 
        // If checker converts to meters, then target SHOULD be meters (e.g. 1000).
        // OR checker logic "distanceMeters = context.distance * 1000" implies DB target is meters.
        // BUT seed says target 1 for "Run 1km".
        // If target is 1, and we pass 1000 meters, it completes instantly.
        // FIX: Let's assume for HUD visual we stick to checking `currentProgress + distance * (factor) >= target`.
        // If target < 100, assume KM. If target > 100, assume Meters. Heuristic.
        const isTargetMeters = mission.target > 100
        const sessionAdd = isTargetMeters ? distance * 1000 : distance
        
        if (currentProgress + sessionAdd >= mission.target) {
          isHit = true
        }
      } else if (mission.type === 'HEX_COUNT') {
        if (currentProgress + hexesCaptured >= mission.target) {
          isHit = true
        }
      }

      if (isHit) {
        setCompletedMissionIds(prev => new Set(prev).add(mission.id))
        toast.success("任务完成！", {
          description: `恭喜达成: ${mission.title}`,
          icon: <Trophy className="h-5 w-5 text-yellow-400" />,
          duration: 4000
        })
      }
    })
  }, [distance, hexesCaptured, activeMissions, completedMissionIds])

  return (
    <>
      <RunningSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Locked Overlay */}
      {isLocked && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] touch-none select-none"
          onTouchStart={handleUnlockPressStart}
          onTouchEnd={handleUnlockPressEnd}
          onMouseDown={handleUnlockPressStart}
          onMouseUp={handleUnlockPressEnd}
          onMouseLeave={handleUnlockPressEnd}
        >
          <div className="flex flex-col items-center gap-4 p-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 animate-pulse">
            <Lock className="h-12 w-12 text-white" />
            <span className="text-sm font-medium text-white">长按解锁</span>
          </div>
          
          {/* Unlock Progress Ring could go here */}
          {showUnlockHint && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-32 w-32 rounded-full border-4 border-[#22c55e] animate-ping opacity-50" />
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20">
      
      {/* TOP SECTION: Secondary Metrics */}
      <div className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 flex justify-between items-start w-full">
        {/* Left: Duration & Missions */}
        <div className="flex flex-col items-start gap-4">
          <div className="flex flex-col items-start">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">时长</span>
            <span className="font-mono text-3xl font-medium text-white tabular-nums">
              {duration}
            </span>
          </div>

          {/* Mission Widget (Left Side) */}
          <AnimatePresence>
            {!isMapMode && activeMissions.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-1 pointer-events-auto"
              >
                {activeMissions.map(mission => {
                  let progress = mission.current || 0
                  let unit = ""
                  let target = mission.target
                  
                  // Calculate display progress
                  if (mission.type === 'DISTANCE_DAILY') {
                    const isTargetMeters = target > 100
                    const sessionAdd = isTargetMeters ? distance * 1000 : distance
                    progress += sessionAdd
                    unit = isTargetMeters ? "m" : "km"
                  } else if (mission.type === 'HEX_COUNT') {
                    progress += hexesCaptured
                    unit = "块"
                  } else {
                    // Skip unsupported types for HUD
                    return null 
                  }
                  
                  // Cap progress for display
                  progress = Math.min(progress, target)
                  const isDone = progress >= target || completedMissionIds.has(mission.id)

                  return (
                    <MissionTrackerItem 
                      key={mission.id}
                      title={mission.title}
                      current={progress}
                      target={target}
                      unit={unit}
                      isCompleted={isDone}
                    />
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Calories & Hexes - BIGGER as requested */}
        <div className="flex flex-col items-end gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1 mb-1">
              <Flame size={12} /> 卡路里
            </span>
            <span className="font-mono text-4xl font-bold text-white tabular-nums drop-shadow-md">
              <AnimatedCounter value={calories} decimals={0} />
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-[#22c55e]/60 uppercase tracking-widest flex items-center gap-1 mb-1">
              <MapIcon size={12} /> 领地
            </span>
            <span className="font-mono text-4xl font-bold text-[#22c55e] tabular-nums drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
              {hexesCaptured}
            </span>
          </div>
        </div>
      </div>

      {/* CENTER SECTION: Main Metrics (Hidden in Map Mode) */}
      {!isMapMode && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[6rem] font-black italic tracking-tighter text-white drop-shadow-2xl leading-none">
              <AnimatedCounter value={distance} />
            </span>
            <span className="text-xl font-bold text-white/60 italic">公里</span>
          </div>
          
          <div className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 backdrop-blur-sm border border-white/5">
            <Zap className="h-4 w-4 text-[#22c55e] animate-pulse" />
            <span className="font-mono text-2xl font-bold text-white">{pace}</span>
            <span className="text-xs text-white/40">/公里</span>
          </div>
        </div>
      )}

      {/* BOTTOM SECTION: Controls */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+20px)] w-full flex flex-col items-center gap-8 pointer-events-auto bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-12">
        
        {/* Three Buttons Row: Lock | Map | Settings */}
        <div className="flex items-center gap-12">
          {/* Lock Button */}
          <button 
            onClick={handleLockPressStart}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all group-active:scale-95 group-active:bg-white/20">
              <Lock className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] text-white/60 font-medium">锁定</span>
          </button>

          {/* Map Button (Center) */}
          <button 
            onClick={() => setIsMapMode(!isMapMode)}
            className={cn(
              "flex flex-col items-center gap-2 group transition-all",
              isMapMode ? "scale-110" : ""
            )}
          >
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center transition-all shadow-lg border",
              isMapMode 
                ? "bg-[#22c55e] border-[#22c55e] text-black shadow-[0_0_20px_rgba(34,197,94,0.4)]" 
                : "bg-white/10 backdrop-blur-md border-white/20 text-white"
            )}>
              <MapIcon className={cn("h-7 w-7", isMapMode ? "fill-current" : "")} />
            </div>
            <span className={cn(
              "text-xs font-medium transition-colors",
              isMapMode ? "text-[#22c55e]" : "text-white/60"
            )}>
              {isMapMode ? "数据" : "地图"}
            </span>
          </button>

          {/* Settings Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all group-active:scale-95 group-active:bg-white/20">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <span className="text-[10px] text-white/60 font-medium">设置</span>
          </button>
        </div>

        {/* Controls */}
        <div className="mb-4 w-full flex justify-center px-4">
          <AnimatePresence mode="wait">
            {isPaused ? (
              <motion.div
                key="paused-controls"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full flex justify-center"
              >
                <PausedControls onResume={onPauseToggle} onFinish={onStop} />
              </motion.div>
            ) : (
              <motion.div
                key="running-controls"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full flex justify-center"
              >
                <SlideToPause onPause={onPauseToggle} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
    </>
  )
}
