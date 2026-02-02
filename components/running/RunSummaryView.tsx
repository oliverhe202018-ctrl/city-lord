"use client"

import { Share2, X, Activity, Flame, Zap, MapPin, Footprints, Timer, Trophy } from "lucide-react"
import { motion } from "framer-motion"
import { HEX_AREA_SQ_METERS } from "@/lib/citylord/area-utils"

interface RunSummaryViewProps {
  distance: number // km
  duration: string // "HH:MM:SS"
  pace: string // "MM'SS""
  calories: number
  hexesCaptured: number
  steps?: number
  onClose: () => void
  onShare?: () => void
}

export function RunSummaryView({
  distance,
  duration,
  pace,
  calories,
  hexesCaptured,
  steps = 0,
  onClose,
  onShare
}: RunSummaryViewProps) {
  // Mock data for missing fields
  const avgSpeed = duration !== "00:00:00" ? (distance / (parseInt(duration.split(':')[0]) + parseInt(duration.split(':')[1])/60)).toFixed(1) : "0.0"
  
  // Calculate territory area based on game constants
  const capturedArea = hexesCaptured * HEX_AREA_SQ_METERS
  
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-white text-black animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
           <div className="h-8 w-8 rounded-full bg-yellow-400 flex items-center justify-center text-white font-bold">
             CL
           </div>
           <div>
             <div className="text-xs text-gray-500">来源: CityLord</div>
             <div className="text-sm font-bold text-[#22c55e]">户外跑步</div>
           </div>
        </div>
        <button 
          onClick={onShare}
          className="flex items-center gap-1 text-sm text-[#22c55e] border border-[#22c55e] rounded-full px-3 py-1"
        >
          <Share2 size={14} />
          动态轨迹图
        </button>
        <div className="h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
           {/* Avatar placeholder */}
           <div className="w-full h-full bg-slate-300" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50/50">
        {/* Main Stat: Distance */}
        <div className="pt-8 pb-4 text-center">
           <div className="text-[5rem] leading-none font-bold text-gray-900 tracking-tighter">
             {distance.toFixed(2)}
           </div>
           <div className="text-gray-500 text-sm mt-1">公里</div>
        </div>

        {/* Divider / Info */}
        <div className="flex justify-center items-center gap-2 mb-8">
           <div className="h-[1px] w-12 bg-gray-200"></div>
           <div className="text-xs text-[#22c55e]">这是第 N 次跑步</div>
           <div className="h-[1px] w-12 bg-gray-200"></div>
        </div>

        {/* Stats Grid 3x2 */}
        <div className="grid grid-cols-3 gap-y-8 px-4 mb-8">
           {/* Avg Pace */}
           <div className="text-center">
             <div className="text-2xl font-bold text-gray-900">{pace}</div>
             <div className="text-xs text-gray-400 mt-1">平均配速</div>
           </div>
           {/* Duration */}
           <div className="text-center">
             <div className="text-2xl font-bold text-gray-900">{duration}</div>
             <div className="text-xs text-gray-400 mt-1">运动时长</div>
           </div>
           {/* Calories */}
           <div className="text-center">
             <div className="text-2xl font-bold text-gray-900">{calories}</div>
             <div className="text-xs text-gray-400 mt-1">消耗热量(Kcal)</div>
           </div>
           
           {/* Speed */}
           <div className="text-center">
             <div className="text-2xl font-bold text-gray-900">0.0</div>
             <div className="text-xs text-gray-400 mt-1">速度(km/h)</div>
           </div>
           {/* Steps / Stride */}
           <div className="text-center">
             <div className="text-2xl font-bold text-gray-900">{steps}</div>
             <div className="text-xs text-gray-400 mt-1">步数</div>
           </div>
           {/* Territory Captured - RED FONT */}
           <div className="text-center">
             <div className="text-2xl font-bold text-red-500">{hexesCaptured * 650}</div>
             <div className="text-xs text-gray-400 mt-1">领地占领㎡</div>
           </div>
        </div>

        {/* Achievement / Result Badges */}
        <div className="bg-white mx-4 rounded-xl p-4 shadow-sm mb-4">
           <div className="text-sm font-bold text-gray-900 mb-4">运动成果</div>
           
           <div className="flex items-center justify-between mb-3">
             <div className="text-sm text-gray-600">
               用时{duration}，刷新了单次最长跑步时间
             </div>
             <Trophy className="h-5 w-5 text-yellow-500" />
           </div>
           
           <div className="flex items-center justify-between">
             <div className="text-sm text-gray-600">
               占领了 {hexesCaptured} 块新领地
             </div>
             <MapPin className="h-5 w-5 text-red-400" />
           </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 bg-white border-t border-gray-100 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex gap-3">
           <button 
             onClick={onClose}
             className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-3 rounded-full transition-all active:scale-[0.98]"
           >
             完成运动
           </button>
           <button 
             onClick={onShare}
             className="flex-1 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold py-3 rounded-full transition-all active:scale-[0.98]"
           >
             分享战绩
           </button>
        </div>
      </div>
    </div>
  )
}
