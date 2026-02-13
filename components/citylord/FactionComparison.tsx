"use client"

import { useFactionStats } from '@/hooks/useGameData'
import { Hexagon, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface FactionComparisonProps {
  userFaction: 'RED' | 'BLUE' | null
  initialData?: any
  redArea?: number
  blueArea?: number
  dailyStat?: {
    redCount: number
    blueCount: number
    date: string | Date
  } | null
}

export function FactionComparison({ initialData, redArea: propRedArea, blueArea: propBlueArea, dailyStat }: FactionComparisonProps) {
  // Debug log
  console.log('Stats Data:', initialData);

  // 1. Get Member Counts: Prioritize dailyStat (snapshot), then initialData
  const redMembers = dailyStat?.redCount ?? initialData?.red_user_count ?? initialData?.redUserCount ?? initialData?.redCount ?? initialData?.red_faction ?? initialData?.RED ?? 0
  const blueMembers = dailyStat?.blueCount ?? initialData?.blue_user_count ?? initialData?.blueUserCount ?? initialData?.blueCount ?? initialData?.blue_faction ?? initialData?.BLUE ?? 0
  
  // Member percentages
  const totalMembers = redMembers + blueMembers
  const redMemberPercent = totalMembers > 0 ? (redMembers / totalMembers) * 100 : 50
  const blueMemberPercent = 100 - redMemberPercent

  // Determine Weaker Faction (by Member Count)
  const weakerFaction = redMembers < blueMembers ? 'RED' : (blueMembers < redMembers ? 'BLUE' : null)
  const buffPercentage = 15 // Fixed 15% buff for now

  // 2. Get Area Stats (Use props if available, else initialData)
  const redArea = propRedArea ?? initialData?.redArea ?? initialData?.red_area ?? 0
  const blueArea = propBlueArea ?? initialData?.blueArea ?? initialData?.blue_area ?? 0

  // Area percentages
  const totalArea = redArea + blueArea
  const redAreaPercent = totalArea > 0 ? (redArea / totalArea) * 100 : 50
  const blueAreaPercent = 100 - redAreaPercent

  // Format numbers for display
  const redAreaFormatted = new Intl.NumberFormat('en-US').format(Math.round(redArea || 0)); 
  const blueAreaFormatted = new Intl.NumberFormat('en-US').format(Math.round(blueArea || 0));

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-4 space-y-6 shadow-sm">
      
      {/* Section 1: Faction Battle Status (Members) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-muted-foreground">阵营战况</h3>
          <span className="text-[10px] text-muted-foreground/60">本栏目数据每日0点更新</span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex mb-2">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${redMemberPercent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] relative"
          >
             {/* Glossy effect */}
             <div className="absolute top-0 left-0 right-0 h-[40%] bg-white/20"></div>
          </motion.div>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${blueMemberPercent}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
            className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] relative"
          >
             <div className="absolute top-0 left-0 right-0 h-[40%] bg-white/20"></div>
          </motion.div>
        </div>

        {/* Stats Row */}
        <div className="flex justify-between items-start">
          {/* Red Side */}
          <div className="flex flex-col items-start">
             <div className="flex items-center gap-1.5 text-red-500 mb-0.5">
                <Shield className="w-3.5 h-3.5 fill-current" />
                <span className="text-lg font-bold leading-none">{redMembers}</span>
             </div>
             <span className="text-[10px] text-red-500/60 font-medium">赤红先锋 {redMemberPercent.toFixed(1)}%</span>
          </div>

          {/* Blue Side */}
          <div className="flex flex-col items-end">
             <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
                <span className="text-lg font-bold leading-none">{blueMembers}</span>
                <Hexagon className="w-3.5 h-3.5 fill-current" />
             </div>
             <span className="text-[10px] text-blue-400/60 font-medium">蔚蓝联盟 {blueMemberPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-border w-full" />

      {/* Section 2: Territory Power (Area) */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">领地势力</h3>
        
        {/* Progress Bar */}
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex mb-2">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${redAreaPercent}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-red-900 to-red-600 relative"
          />
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${blueAreaPercent}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
            className="h-full bg-gradient-to-l from-blue-900 to-blue-600 relative"
          />
        </div>

        {/* Stats Row */}
        <div className="flex justify-between items-center">
           {/* Red Area */}
           <div className="flex flex-col items-start">
             <div className="flex items-center gap-1.5 text-red-500/80">
                <Hexagon className="w-3 h-3" />
                <span className="text-xs font-medium">
                  {redAreaFormatted}
                </span>
             </div>
             {weakerFaction === 'RED' && (
               <span className="text-[10px] text-red-500/50 mt-0.5">
                 (含增益{buffPercentage}%)
               </span>
             )}
           </div>

           {/* Blue Area */}
           <div className="flex flex-col items-end">
             <div className="flex items-center gap-1.5 text-blue-400/80">
                <span className="text-xs font-medium">
                  {blueAreaFormatted}
                </span>
                <Hexagon className="w-3 h-3" />
             </div>
             {weakerFaction === 'BLUE' && (
               <span className="text-[10px] text-blue-400/50 mt-0.5">
                 (含增益{buffPercentage}%)
               </span>
             )}
           </div>
        </div>
      </div>

    </div>
  )
}
