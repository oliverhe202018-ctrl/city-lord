"use client"

import { Pause, Play, ChevronLeft, Settings, MapPin, Eye, EyeOff } from "lucide-react"
import { motion } from "framer-motion"
import { formatArea } from "@/lib/citylord/area-utils"
import { useState, useEffect } from "react"

// Smart distance formatter: input is in METERS
function formatDistance(meters: number): { value: string; unit: string } {
  if (meters < 1000) {
    return { value: String(Math.round(meters)), unit: '米' };
  }
  return { value: (meters / 1000).toFixed(2), unit: '公里' };
}

interface RunningMapOverlayProps {
  distanceMeters: number // meters (raw)
  duration: string // "HH:MM:SS"
  pace: string // "MM:SS"
  area: number // m² (total claimed area)
  isPaused: boolean
  onPauseToggle: () => void
  onStop?: () => void
  onBack: () => void
  onRecenter: () => void
  // Kingdom props (passed from ImmersiveRunningMode — no context needed)
  showKingdom?: boolean
  onToggleKingdom?: () => void
}

export function RunningMapOverlay({
  distanceMeters,
  duration,
  pace,
  area,
  isPaused,
  onPauseToggle,
  onStop,
  onBack,
  onRecenter,
  showKingdom = false,
  onToggleKingdom,
}: RunningMapOverlayProps) {
  const [confirmStop, setConfirmStop] = useState(false);
  const { value: distValue, unit: distUnit } = formatDistance(distanceMeters);

  // Reset confirm state if paused state changes
  useEffect(() => {
    setConfirmStop(false);
  }, [isPaused]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between pointer-events-none">
      {/* Top Bar */}
      <div className="pt-[calc(env(safe-area-inset-top)+12px)] px-4 flex items-center justify-between pointer-events-auto">
        <button
          onClick={onBack}
          className="h-10 w-10 rounded-full bg-slate-800/90 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-transform border border-white/10"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </button>

        <div className="flex gap-3">
          {onToggleKingdom && (
            <button
              onClick={onToggleKingdom}
              className={`h-10 w-10 rounded-full backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-all border ${showKingdom ? 'bg-amber-500/40 border-amber-500/30' : 'bg-slate-800/90 border-white/10'}`}
              title={showKingdom ? "隐藏领地" : "显示领地"}
            >
              {showKingdom ? <Eye className="h-5 w-5 text-amber-300" /> : <EyeOff className="h-5 w-5 text-white/50" />}
            </button>
          )}
          <button
            onClick={onRecenter}
            className="h-10 w-10 rounded-full bg-slate-800/90 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-transform border border-white/10"
          >
            <MapPin className="h-5 w-5 text-blue-400" />
          </button>
          <button className="h-10 w-10 rounded-full bg-slate-800/90 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition-transform border border-white/10">
            <Settings className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Bottom Card */}
      <div className="w-full bg-slate-900/95 backdrop-blur-xl rounded-t-[2rem] p-6 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] border-t border-white/10 pointer-events-auto animate-in slide-in-from-bottom-20 duration-300">
        {/* Drag Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

        {/* Area Stats (Centered) */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black text-white">{area > 0 ? Math.round(area).toLocaleString() : '--'}</span>
            <span className="text-sm font-bold text-white/60">m²</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium text-white/40 uppercase tracking-wider">正在占领中</span>
            <div className="flex items-end gap-0.5 h-3">
              <div className="w-0.5 h-1 bg-[#22c55e] rounded-full" />
              <div className="w-0.5 h-2 bg-[#22c55e] rounded-full" />
              <div className="w-0.5 h-3 bg-[#22c55e] rounded-full" />
            </div>
            <span className="text-xs font-bold text-[#22c55e]">GPS 强</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Distance — smart unit */}
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black text-white">{distValue}</span>
              <span className="text-xs font-bold text-white/60">{distUnit}</span>
            </div>
            <span className="text-[10px] font-medium text-white/40 uppercase mt-1">距离</span>
          </div>

          {/* Duration */}
          <div className="flex flex-col items-center">
            <span className="text-2xl font-black text-white tracking-tight">{duration}</span>
            <span className="text-[10px] font-medium text-white/40 uppercase mt-1">时长</span>
          </div>

          {/* Pace */}
          <div className="flex flex-col items-center">
            <span className="text-2xl font-black text-white">{pace}</span>
            <span className="text-[10px] font-medium text-white/40 uppercase mt-1">平均配速</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="w-full">
          {isPaused ? (
            <div className="flex gap-2 h-14">
              <button
                disabled={!!confirmStop}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (confirmStop) {
                    if (onStop) onStop();
                  } else {
                    setConfirmStop(true);
                    // Auto-reset after 3 seconds
                    setTimeout(() => setConfirmStop(false), 3000);
                  }
                }}
                className={`flex-1 rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] transition-all ${confirmStop
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                  : 'bg-red-500/20 border border-red-500/50 hover:bg-red-500/30'
                  }`}
              >
                <span className={`${confirmStop ? 'text-white' : 'text-red-400'} font-bold text-sm whitespace-nowrap`}>
                  {confirmStop ? "确认结束?" : "结束"}
                </span>
              </button>
              <button
                disabled={!!confirmStop}
                onClick={onPauseToggle}
                className="flex-[2] bg-[#22c55e] rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] transition-all hover:bg-[#16a34a] shadow-lg shadow-[#22c55e]/20 disabled:opacity-50"
              >
                <Play className="h-4 w-4 text-white fill-current" />
                <span className="text-white font-bold text-sm whitespace-nowrap">继续跑步</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onPauseToggle}
              onDoubleClick={onStop} // Quick stop shortcut
              className="w-full h-14 bg-white/10 border border-white/10 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-white/20 backdrop-blur-md"
            >
              <Pause className="h-5 w-5 text-white fill-current" />
              <span className="text-white font-bold">暂停跑步 (双击结束)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
