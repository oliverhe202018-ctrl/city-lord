"use client"

import { Target, Trophy, Users } from "lucide-react"

interface QuickEntryProps {
  onNavigate: (tab: "missions" | "social" | "running") => void
  missionCount?: number
  friendCount?: number
  rank?: number
}

export function QuickEntry({ onNavigate, missionCount = 0, friendCount = 0, rank = 42 }: QuickEntryProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Missions Entry */}
      <button
        onClick={() => onNavigate("missions")}
        className="group relative flex flex-col items-center rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl transition-all hover:border-cyan-400/30 hover:bg-cyan-400/5 active:scale-[0.98]"
      >
        <div className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/20 transition-all group-hover:bg-cyan-400/30">
          <Target className="h-5 w-5 text-cyan-400" />
        </div>
        <span className="text-xs font-medium text-white">今日任务</span>
        {missionCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {missionCount}
          </span>
        )}
      </button>

      {/* Running Entry - Large Circular Ripple Button */}
      <button
        onClick={() => onNavigate("running")}
        className="group absolute -top-16 left-1/2 -translate-x-1/2 z-20 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-[0_4px_20px_rgba(34,197,94,0.5)] transition-all active:scale-95"
      >
        {/* Ripple Effects */}
        <span className="absolute h-full w-full animate-ping rounded-full bg-[#22c55e]/40" style={{ animationDuration: '2s' }}></span>
        <span className="absolute h-[120%] w-[120%] animate-ping rounded-full bg-[#22c55e]/20" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></span>
        
        <div className="flex flex-col items-center justify-center">
          <span className="text-sm font-bold text-white drop-shadow-md">GO!</span>
          <span className="text-[10px] font-medium text-white/90">跑步</span>
        </div>
      </button>

      {/* Placeholder to maintain grid layout structure if needed, or adjust parent grid */}
      <div className="h-10 w-full" /> 


      {/* Social Entry */}
      <button
        onClick={() => onNavigate("social")}
        className="group flex flex-col items-center rounded-2xl border border-white/10 bg-black/40 p-3 backdrop-blur-xl transition-all hover:border-purple-400/30 hover:bg-purple-400/5 active:scale-[0.98]"
      >
        <div className="mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-400/20 transition-all group-hover:bg-purple-400/30">
          <Users className="h-5 w-5 text-purple-400" />
        </div>
        <span className="text-xs font-medium text-white">好友</span>
        <span className="text-[10px] text-white/40">{friendCount}人</span>
      </button>
    </div>
  )
}
