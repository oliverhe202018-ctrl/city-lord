"use client"

import { useState, useEffect, useCallback } from "react"
import { Pause, Play, Square, ChevronUp, MapPin, Zap, Heart, Hexagon } from "lucide-react"
import { hexCountToArea, formatArea, HEX_AREA_SQ_METERS } from "@/lib/citylord/area-utils"

interface ImmersiveModeProps {
  isActive: boolean
  distance: number // in km
  pace: string // e.g., "6:42"
  time: string // e.g., "00:12:34"
  calories: number
  heartRate?: number
  hexesCaptured: number
  currentHexProgress: number // 0-100
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onExpand: () => void
}

export function ImmersiveRunningMode({
  isActive,
  distance,
  pace,
  time,
  calories,
  heartRate,
  hexesCaptured,
  currentHexProgress,
  onPause,
  onResume,
  onStop,
  onExpand,
}: ImmersiveModeProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [showStopConfirm, setShowStopConfirm] = useState(false)
  const [displayedArea, setDisplayedArea] = useState(0)
  const [areaFlash, setAreaFlash] = useState(false)
  
  // Calculate total captured area
  const totalCapturedArea = hexCountToArea(hexesCaptured)
  const currentPartialArea = Math.round((currentHexProgress / 100) * HEX_AREA_SQ_METERS)
  const totalArea = totalCapturedArea + currentPartialArea
  const formattedArea = formatArea(totalArea)
  
  // Animate area counter with jumping effect
  useEffect(() => {
    if (!isActive || isPaused) return

    const targetArea = totalArea
    if (displayedArea < targetArea) {
      const diff = targetArea - displayedArea
      const increment = Math.max(1, Math.ceil(diff / 10))
      const timer = setTimeout(() => {
        setDisplayedArea(prev => Math.min(prev + increment, targetArea))
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isActive, isPaused, totalArea])
  
  // Flash effect when capturing new hex
  useEffect(() => {
    if (hexesCaptured > 0) {
      setAreaFlash(true)
      const timer = setTimeout(() => setAreaFlash(false), 500)
      return () => clearTimeout(timer)
    }
  }, [hexesCaptured])

  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      setIsPaused(false)
      onResume()
    } else {
      setIsPaused(true)
      onPause()
    }
  }, [isPaused, onPause, onResume])

  const handleStop = useCallback(() => {
    if (!showStopConfirm) {
      setShowStopConfirm(true)
      return
    }
    onStop()
    setShowStopConfirm(false)
  }, [showStopConfirm, onStop])

  // Reset stop confirm after 3s
  useEffect(() => {
    if (showStopConfirm) {
      const timer = setTimeout(() => setShowStopConfirm(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [showStopConfirm])

  if (!isActive) return null

  return (
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-full flex-col bg-black">
      {/* Safe Area Top */}
      <div className="h-[env(safe-area-inset-top)] bg-black" />

      {/* Main Stats - Ultra Large Display */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24">
        {/* Current Pace - Largest */}
        <div className="mb-2 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-[#22c55e]/70">配速</p>
          <p className="font-mono text-8xl font-bold tracking-tight text-[#22c55e]">
            {pace}
          </p>
          <p className="text-lg text-white/40">/公里</p>
        </div>

        {/* Distance - Second Largest */}
        <div className="mt-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-white/50">距离</p>
          <p className="font-mono text-6xl font-bold text-white">
            {distance.toFixed(2)}
          </p>
          <p className="text-lg text-white/40">公里</p>
        </div>

        {/* Time */}
        <div className="mt-6 text-center">
          <p className="font-mono text-4xl font-medium text-white/70">{time}</p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="absolute bottom-12 left-0 right-0 z-50 flex items-center justify-center gap-12 pb-[env(safe-area-inset-bottom)]">
        {/* Pause/Resume Button */}
        <button
          onClick={handlePauseToggle}
          className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all active:scale-95 ${
            isPaused
              ? "border-[#22c55e] bg-[#22c55e] text-white shadow-[0_0_30px_rgba(34,197,94,0.4)]"
              : "border-yellow-400 bg-yellow-400 text-black shadow-[0_0_30px_rgba(234,179,8,0.3)]"
          }`}
        >
          {isPaused ? (
            <Play className="h-8 w-8 translate-x-0.5" fill="currentColor" />
          ) : (
            <Pause className="h-8 w-8" fill="currentColor" />
          )}
        </button>

        {/* Stop Button */}
        <button
          onClick={handleStop}
          className={`flex h-20 w-20 items-center justify-center rounded-full border-2 border-red-500 bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all active:scale-95 ${
            showStopConfirm ? "animate-pulse" : ""
          }`}
        >
          <Square className="h-8 w-8" fill="currentColor" />
        </button>
      </div>

      {/* Stop Confirmation Tooltip */}
      {showStopConfirm && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 animate-fade-in rounded-lg bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm">
          再次点击确认结束
        </div>
      )}
    </div>
  )
}

// Mini FAB for triggering immersive mode from map
export function RunningFAB({
  isRunning,
  onStartRun,
  onViewRunning,
  className = "",
}: {
  isRunning: boolean
  onStartRun: () => void
  onViewRunning: () => void
  className?: string
}) {
  return (
    <div className={`fixed bottom-[calc(env(safe-area-inset-bottom)+7rem)] left-1/2 z-30 -translate-x-1/2 ${className}`}>
      {isRunning ? (
        // Running state - compact view
        <button
          onClick={onViewRunning}
          className="group flex items-center gap-3 rounded-full border-2 border-[#22c55e] bg-black/80 py-2 pl-4 pr-5 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_30px_rgba(34,197,94,0.3)] backdrop-blur-xl transition-all active:scale-95"
        >
          {/* Animated pulse dot */}
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#22c55e]" />
          </span>
          <span className="text-sm font-medium text-white">跑步中...</span>
          <span className="font-mono text-sm font-bold text-[#22c55e]">点击查看</span>
        </button>
      ) : (
        // Idle state - Start Run FAB
        <button
          onClick={onStartRun}
          className="group relative flex h-[72px] w-[72px] items-center justify-center"
        >
          {/* Pulsing rings */}
          <span
            className="absolute h-full w-full animate-ping rounded-full bg-[#22c55e]/30"
            style={{ animationDuration: "2s" }}
          />
          <span
            className="absolute h-[120%] w-[120%] animate-ping rounded-full bg-[#22c55e]/15"
            style={{ animationDuration: "2s", animationDelay: "0.5s" }}
          />

          {/* Main button */}
          <span className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-[#22c55e] bg-gradient-to-br from-[#22c55e]/30 to-[#22c55e]/10 shadow-[0_4px_20px_rgba(0,0,0,0.4),0_0_30px_rgba(34,197,94,0.4)] backdrop-blur-sm transition-all group-hover:scale-105 group-hover:shadow-[0_4px_25px_rgba(0,0,0,0.5),0_0_40px_rgba(34,197,94,0.5)] group-active:scale-95">
            <span className="text-center text-sm font-bold leading-tight text-[#22c55e]">
              开始
              <br />
              跑步
            </span>
          </span>
        </button>
      )}
    </div>
  )
}
