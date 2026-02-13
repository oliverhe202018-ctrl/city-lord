"use client"

import { Pause, Play, ChevronLeft, Settings, MapPin, Signal } from "lucide-react"
import { motion } from "framer-motion"
import { formatArea } from "@/lib/citylord/area-utils"

interface RunningMapOverlayProps {
  distance: number // km
  duration: string // "HH:MM:SS"
  pace: string // "MM:SS"
  area: number // m²
  isPaused: boolean
  onPauseToggle: () => void
  onBack: () => void
}

export function RunningMapOverlay({
  distance,
  duration,
  pace,
  area,
  isPaused,
  onPauseToggle,
  onBack
}: RunningMapOverlayProps) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-between pointer-events-none">
      {/* Top Bar */}
      <div className="pt-[calc(env(safe-area-inset-top)+12px)] px-4 flex items-center justify-between pointer-events-auto">
        <button 
          onClick={onBack}
          className="h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform"
        >
          <ChevronLeft className="h-6 w-6 text-black" />
        </button>

        <div className="flex gap-3">
           <button className="h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform">
             <MapPin className="h-5 w-5 text-blue-500" />
           </button>
           <button className="h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center active:scale-95 transition-transform">
             <Settings className="h-5 w-5 text-black" />
           </button>
        </div>
      </div>

      {/* Bottom Card */}
      <div className="w-full bg-white rounded-t-[2rem] p-6 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-[0_-4px_20px_rgba(0,0,0,0.1)] pointer-events-auto animate-in slide-in-from-bottom-20 duration-300">
        {/* Drag Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />

        {/* Area Stats (Centered) */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-baseline gap-1">
             <span className="text-4xl font-black text-black">{area}</span>
             <span className="text-sm font-bold text-gray-500">m²</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
             <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">正在占领中</span>
             <div className="flex items-end gap-0.5 h-3">
                <div className="w-0.5 h-1 bg-[#22c55e] rounded-full animate-pulse" />
                <div className="w-0.5 h-2 bg-[#22c55e] rounded-full animate-pulse delay-75" />
                <div className="w-0.5 h-3 bg-[#22c55e] rounded-full animate-pulse delay-150" />
             </div>
             <span className="text-xs font-bold text-[#22c55e]">GPS 强</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Distance */}
          <div className="flex flex-col items-center">
             <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black text-black">{distance.toFixed(2)}</span>
                <span className="text-xs font-bold text-gray-500">km</span>
             </div>
             <span className="text-[10px] font-medium text-gray-400 uppercase mt-1">距离</span>
          </div>

          {/* Duration */}
          <div className="flex flex-col items-center">
             <span className="text-2xl font-black text-black tracking-tight">{duration}</span>
             <span className="text-[10px] font-medium text-gray-400 uppercase mt-1">时长</span>
          </div>

          {/* Pace */}
          <div className="flex flex-col items-center">
             <span className="text-2xl font-black text-black">{pace}</span>
             <span className="text-[10px] font-medium text-gray-400 uppercase mt-1">平均配速</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onPauseToggle}
          className="w-full h-14 bg-[#1a1a1a] rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-black"
        >
          {isPaused ? (
             <>
               <Play className="h-5 w-5 text-white fill-current" />
               <span className="text-white font-bold">继续跑步</span>
             </>
          ) : (
             <>
               <Pause className="h-5 w-5 text-white fill-current" />
               <span className="text-white font-bold">暂停跑步</span>
             </>
          )}
        </button>
      </div>
    </div>
  )
}
