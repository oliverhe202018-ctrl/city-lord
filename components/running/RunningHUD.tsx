"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion"
import { Play, Pause, Square, Lock, Unlock, Zap, Flame, Map, Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

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
// Sub-component: Slide to Unlock/Stop Button
// ----------------------------------------------------------------------------
function SlideButton({ onSlideComplete, isPaused }: { onSlideComplete: () => void, isPaused: boolean }) {
  const [dragX, setDragX] = useState(0)
  const constraintsRef = useRef(null)
  const SLIDE_THRESHOLD = 200 // pixels to slide to trigger action

  return (
    <div className="relative w-full max-w-[280px] h-16 bg-white/10 backdrop-blur-md rounded-full overflow-hidden border border-white/20" ref={constraintsRef}>
      {/* Track Text */}
      <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm font-medium pointer-events-none uppercase tracking-widest">
        {isPaused ? "滑动结束跑步" : "滑动暂停跑步"} <span className="ml-2">{">>>"}</span>
      </div>

      {/* Progress Fill (Optional visual feedback) */}
      <motion.div 
        className="absolute inset-y-0 left-0 bg-white/10" 
        style={{ width: dragX + 32 }} // +32 for half button width
      />

      {/* Draggable Knob */}
      <motion.div
        className={cn(
          "absolute top-1 left-1 bottom-1 w-14 rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing z-10",
          isPaused ? "bg-red-500 text-white" : "bg-[#22c55e] text-black"
        )}
        drag="x"
        dragConstraints={{ left: 0, right: SLIDE_THRESHOLD }}
        dragElastic={0.1}
        dragMomentum={false}
        onDrag={(event, info) => {
          setDragX(info.point.x)
        }}
        onDragEnd={(event, info) => {
          if (info.offset.x > SLIDE_THRESHOLD - 20) {
            onSlideComplete()
          }
          setDragX(0)
        }}
        animate={{ x: 0 }} // Snap back if not completed
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {isPaused ? <Square size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
      </motion.div>
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
  // Handle slide action
  const handleSlideAction = () => {
    if (isPaused) {
      onStop()
    } else {
      onPauseToggle()
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20">
      
      {/* TOP SECTION: Secondary Metrics */}
      <div className="pt-[calc(env(safe-area-inset-top)+20px)] px-6 flex justify-between items-start w-full">
        {/* Left: Duration */}
        <div className="flex flex-col items-start">
          <span className="text-xs font-bold text-white/40 uppercase tracking-widest">Duration</span>
          <span className="font-mono text-2xl font-medium text-white tabular-nums">
            {duration}
          </span>
        </div>

        {/* Right: Calories & Hexes */}
        <div className="flex flex-col items-end gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1">
              <Flame size={10} /> Calories
            </span>
            <span className="font-mono text-xl font-medium text-white tabular-nums">
              <AnimatedCounter value={calories} decimals={0} />
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-[#22c55e]/60 uppercase tracking-widest flex items-center gap-1">
              <Map size={10} /> Hexes
            </span>
            <span className="font-mono text-xl font-medium text-[#22c55e] tabular-nums">
              <AnimatedCounter value={hexesCaptured} decimals={0} />
            </span>
          </div>
        </div>
      </div>

      {/* CENTER AREA: Status Messages (AnimatePresence) */}
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence>
          {isPaused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-yellow-500/30 flex items-center gap-3"
            >
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              <span className="text-yellow-500 font-bold uppercase tracking-wider text-sm">PAUSED</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM SECTION: Primary Metric & Controls */}
      <div className="pb-[calc(env(safe-area-inset-bottom)+40px)] px-6 w-full bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col items-center gap-8">
        
        {/* Primary Metric: Distance (Huge) */}
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <AnimatedCounter value={distance} className="text-8xl font-black text-white italic drop-shadow-2xl" decimals={2} />
            <span className="text-xl font-bold text-white/50 uppercase italic">KM</span>
          </div>
          
          {/* Pace (Secondary Large) */}
          <div className="flex items-center gap-2 mt-[-10px]">
            <Zap size={16} className="text-[#22c55e]" />
            <span className="font-mono text-3xl font-bold text-white tabular-nums">{pace}</span>
            <span className="text-xs font-bold text-white/40 uppercase">/KM</span>
          </div>
        </div>

        {/* Controls: Slide Button */}
        <div className="pointer-events-auto w-full flex flex-col items-center gap-4">
          {/* Resume Button (Only visible when paused) */}
          <AnimatePresence>
            {isPaused && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={onPauseToggle}
                className="w-full max-w-[280px] h-14 bg-[#22c55e] text-black font-bold uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(34,197,94,0.4)] flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-transform"
              >
                <Play size={20} fill="currentColor" /> Resume Run
              </motion.button>
            )}
          </AnimatePresence>

          {/* Slide to Stop/Pause */}
          {!isPaused && (
             <div className="pointer-events-auto w-full flex justify-center">
               <SlideButton onSlideComplete={handleSlideAction} isPaused={isPaused} />
             </div>
          )}

          {/* Stop Button (Only visible when paused, alternative to slide) */}
          {isPaused && (
             <button 
               onClick={onStop}
               className="text-white/40 text-xs font-medium uppercase tracking-widest hover:text-white transition-colors"
             >
               Long press to end run
             </button>
          )}
        </div>
      </div>
    </div>
  )
}
