'use client'

import { useFactionStats } from '@/hooks/useGameData'
import { Hexagon, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { formatArea } from "@/lib/citylord/area-utils"
import { calculateFactionBalance } from '@/utils/faction-balance'
import { FactionBattleBackground } from '@/components/Faction/FactionBattleBackground'

interface FactionComparisonProps {
  userFaction: 'RED' | 'BLUE' | null
  initialData?: any
  redArea?: number
  blueArea?: number
}

export function FactionComparison({ userFaction, initialData, redArea: propRedArea, blueArea: propBlueArea }: FactionComparisonProps) {
  // Use props if available, otherwise fallback to initialData or 0
  const redArea = propRedArea ?? initialData?.redArea ?? 0
  const blueArea = propBlueArea ?? initialData?.blueArea ?? 0

  // 50/50 Rule
  const totalArea = redArea + blueArea
  let redPercent = 50
  if (totalArea > 0) {
      redPercent = (redArea / totalArea) * 100
  }
  const bluePercent = 100 - redPercent

  // Formatted values
  const redFormatted = formatArea(redArea)
  const blueFormatted = formatArea(blueArea)

  // Loading state
  const isLoading = (propRedArea === undefined && initialData === undefined)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40 flex items-center gap-2">
           <Hexagon className="w-4 h-4" />
           领地势力对抗
        </h2>
        {userFaction && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border font-medium",
            userFaction === 'RED' ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-blue-400 border-blue-500/30 bg-blue-500/10"
          )}>
            我方: {userFaction === 'RED' ? '赤红先锋' : '蔚蓝联盟'}
          </span>
        )}
      </div>

      {/* Main Visual: Area based FactionBattleBackground */}
      <div className="relative h-16 w-full rounded-xl overflow-hidden mb-4">
         <FactionBattleBackground 
            redArea={redArea} 
            blueArea={blueArea} 
            isLoading={isLoading} 
         />
         
         {/* Overlaid Stats on the bar */}
         <div className="absolute inset-0 flex items-center justify-between px-4 z-10 pointer-events-none">
            {/* Red */}
            <div className="flex flex-col items-start shadow-sm">
                <span className="text-xs font-bold text-white drop-shadow-md">RED</span>
                <span className="text-lg font-black text-white drop-shadow-md leading-none">
                    {redPercent.toFixed(1)}%
                </span>
            </div>
            
            {/* VS */}
            <div className="text-white/80 font-bold italic text-xl drop-shadow-md">VS</div>

            {/* Blue */}
            <div className="flex flex-col items-end shadow-sm">
                <span className="text-xs font-bold text-white drop-shadow-md">BLUE</span>
                <span className="text-lg font-black text-white drop-shadow-md leading-none">
                    {bluePercent.toFixed(1)}%
                </span>
            </div>
         </div>
      </div>

      {/* Detailed Stats below */}
      <div className="flex justify-between items-center px-1">
         {/* Red Detail */}
         <div className="text-left">
             <div className="text-xs text-red-400/70 uppercase tracking-wider mb-1">赤红领地</div>
             <div className="text-xl font-bold text-white leading-none">
                 {redFormatted.value} <span className="text-xs text-white/50 font-normal">{redFormatted.unit}</span>
             </div>
         </div>

         {/* Blue Detail */}
         <div className="text-right">
             <div className="text-xs text-blue-400/70 uppercase tracking-wider mb-1">蔚蓝领地</div>
             <div className="text-xl font-bold text-white leading-none">
                 {blueFormatted.value} <span className="text-xs text-white/50 font-normal">{blueFormatted.unit}</span>
             </div>
         </div>
      </div>
    </div>
  )
}
