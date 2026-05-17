"use client"

import { Signal, CloudSun, Pause, ChevronUp } from "lucide-react"

interface RunningStatusBarProps {
  time: string
  distance: number
  pace: string
  gpsStrength: 1 | 2 | 3 | 4 | 5
  isRunning?: boolean
  onPause?: () => void
}

export function RunningStatusBar({
  time = "00:00:00",
  distance = 0,
  pace = "0:00",
  gpsStrength = 5,
  isRunning = false,
  onPause,
}: RunningStatusBarProps) {
  const getGpsColor = () => {
    if (gpsStrength >= 4) return "text-primary"
    if (gpsStrength >= 2) return "text-yellow-400"
    return "text-destructive"
  }

  const getGpsBars = () => {
    return Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        className={`w-1 rounded-full transition-all ${
          i < gpsStrength
            ? gpsStrength >= 4
              ? "bg-primary"
              : gpsStrength >= 2
                ? "bg-yellow-400"
                : "bg-destructive"
            : "bg-muted"
        }`}
        style={{ height: `${8 + i * 3}px` }}
      />
    ))
  }

  return (
    <div className="w-full">
      {/* Compact Top Bar - Always visible */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card/60 px-4 py-3 backdrop-blur-xl">
        {/* GPS Signal */}
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-0.5">
            {getGpsBars()}
          </div>
          <span className={`text-xs font-medium ${getGpsColor()}`}>GPS</span>
        </div>

        {/* Weather */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CloudSun className="h-4 w-4" />
          <span className="text-xs">18°C</span>
        </div>

        {/* Signal Icon */}
        <Signal className={`h-4 w-4 ${getGpsColor()}`} />
      </div>

      {/* Expanded Running HUD - Only when running */}
      {isRunning && (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-card/70 p-4 backdrop-blur-xl">
          {/* Main Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            {/* Time */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">时间</p>
              <p className="font-mono text-2xl font-bold text-foreground">{time}</p>
            </div>
            
            {/* Distance */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">距离</p>
              <p className="font-mono text-2xl font-bold text-primary">
                {distance.toFixed(2)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">公里</span>
              </p>
            </div>
            
            {/* Pace */}
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">配速</p>
              <p className="font-mono text-2xl font-bold text-foreground">
                {pace}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/公里</span>
              </p>
            </div>
          </div>

          {/* Hex Capture Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/60">领地占领进度</span>
              <span className="font-medium text-[#22c55e]">80%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#22c55e]/70 transition-all duration-500"
                style={{ width: "80%" }}
              />
            </div>
          </div>

          {/* Pause Button */}
          {onPause && (
            <button
              onClick={onPause}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 py-2.5 text-white transition-all hover:bg-white/10 active:scale-[0.98]"
            >
              <Pause className="h-4 w-4" />
              <span className="text-sm font-medium">暂停跑步</span>
            </button>
          )}

          {/* Collapse indicator */}
          <div className="mt-3 flex justify-center">
            <ChevronUp className="h-4 w-4 animate-bounce text-white/30" />
          </div>
        </div>
      )}
    </div>
  )
}
