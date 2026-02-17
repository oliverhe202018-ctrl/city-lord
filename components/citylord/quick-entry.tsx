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
    <div className="grid grid-cols-3 gap-8">
      {/* Missions Entry - Shrunk 0.66x */}
      <button
        onClick={() => onNavigate("missions")}
        className="group relative mb-[90px] flex flex-col items-center rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl transition-all hover:border-cyan-400/30 hover:bg-cyan-400/5 active:scale-[0.98]"
      >
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/20 transition-all group-hover:bg-cyan-400/30">
          <Target className="h-4 w-4 text-cyan-400" />
        </div>
        <span className="text-[10px] font-medium text-white">任务</span>
        {missionCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
            {missionCount}
          </span>
        )}
      </button>

      {/* Running Entry - Enlarged 1.3x GO Button */}
      <button
        onClick={() => onNavigate("running")}
        className="group absolute -top-20 left-1/2 -translate-x-1/2 z-20 flex h-[104px] w-[104px] items-center justify-center rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] shadow-[0_4px_24px_rgba(34,197,94,0.6)] transition-all active:scale-95"
      >
        {/* Ripple Effects - Non-interactive glow */}
        <span className="absolute h-full w-full animate-ping rounded-full bg-[#22c55e]/40 pointer-events-none" style={{ animationDuration: '2s' }}></span>
        <span className="absolute h-[120%] w-[120%] animate-ping rounded-full bg-[#22c55e]/20 pointer-events-none" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></span>

        <div className="flex flex-col items-center justify-center">
          <span className="text-lg font-extrabold text-white drop-shadow-md">GO!</span>
          <span className="text-xs font-medium text-white/90">跑步</span>
        </div>
      </button>

      {/* Placeholder to maintain grid layout structure */}
      <div className="h-10 w-full" />

      {/* Social Entry - Shrunk 0.66x */}
      <button
        onClick={() => onNavigate("social")}
        className="group mb-[90px] flex flex-col items-center rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl transition-all hover:border-purple-400/30 hover:bg-purple-400/5 active:scale-[0.98]"
      >
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-400/20 transition-all group-hover:bg-purple-400/30">
          <Users className="h-4 w-4 text-purple-400" />
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] font-medium text-white">好友</span>
          <span className="text-[8px] text-white/40">({friendCount})</span>
        </div>
      </button>
    </div>
  )
}
