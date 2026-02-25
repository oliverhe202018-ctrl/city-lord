"use client"

import { Pause, Play, ChevronLeft, Settings, MapPin, Eye, EyeOff } from "lucide-react"
import { motion } from "framer-motion"
import { formatArea } from "@/lib/citylord/area-utils"
import { useState, useEffect, useRef } from "react"

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
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { value: distValue, unit: distUnit } = formatDistance(distanceMeters);

  // Reset confirm state if paused state changes, and clear timer
  useEffect(() => {
    setConfirmStop(false);
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, [isPaused]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    };
  }, []);

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
      <div className="w-full bg-slate-900/95 backdrop-blur-xl rounded-t-[2rem] p-6 pb-8 mb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] border-t border-white/10 pointer-events-auto animate-in slide-in-from-bottom-20 duration-300 overflow-visible">
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
            <div className="flex flex-row items-stretch gap-3 h-14">
              {/* 结束按钮 — 不再 disabled，两次点击都能触发 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (confirmStop) {
                    // 第二次点击：清除计时器后执行结束
                    if (confirmTimerRef.current) {
                      clearTimeout(confirmTimerRef.current);
                      confirmTimerRef.current = null;
                    }
                    if (onStop) onStop();
                  } else {
                    // 第一次点击：进入确认状态，启动可取消的计时器
                    setConfirmStop(true);
                    confirmTimerRef.current = setTimeout(() => {
                      setConfirmStop(false);
                      confirmTimerRef.current = null;
                    }, 5000);
                  }
                }}
                className={`flex-1 h-full rounded-xl flex items-center justify-center gap-1 transition-colors ${confirmStop
                  ? 'bg-red-600 hover:bg-red-700 animate-breathing'
                  : 'bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 active:scale-[0.98]'
                  }`}
              >
                <span className={`${confirmStop ? 'text-white' : 'text-red-400'} font-bold text-sm whitespace-nowrap`}>
                  {confirmStop ? "确认结束?" : "结束"}
                </span>
              </button>
              {/* 继续跑步按钮 — 点击时同时取消确认状态 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirmStop) {
                    setConfirmStop(false);
                    if (confirmTimerRef.current) {
                      clearTimeout(confirmTimerRef.current);
                      confirmTimerRef.current = null;
                    }
                  }
                  if (onPauseToggle) onPauseToggle();
                }}
                className="flex-1 h-full bg-[#22c55e] rounded-xl flex items-center justify-center gap-1 active:scale-[0.98] transition-all hover:bg-[#16a34a] shadow-lg shadow-[#22c55e]/20"
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
