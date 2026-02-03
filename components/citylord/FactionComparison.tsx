'use client'

import { useEffect, useState } from 'react'
import { getFactionStats } from '@/app/actions/faction'
import { Hexagon, Shield, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { formatAreaFromHexCount } from "@/lib/citylord/area-utils"

interface FactionComparisonProps {
  userFaction: 'RED' | 'BLUE' | null
}

export function FactionComparison({ userFaction }: FactionComparisonProps) {
  const [stats, setStats] = useState({ 
    RED: 0, 
    BLUE: 0, 
    area: { RED: 0, BLUE: 0 }, 
    bonus: { RED: 0, BLUE: 0 } 
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFactionStats().then(data => {
      // @ts-ignore
      setStats(data)
      setLoading(false)
    })
  }, [])

  // Calculate boosted areas
  const boostedRedArea = stats.area?.RED * (1 + (stats.bonus?.RED || 0) / 100)
  const boostedBlueArea = stats.area?.BLUE * (1 + (stats.bonus?.BLUE || 0) / 100)

  // Member percentages
  const total = stats.RED + stats.BLUE
  const redPercent = total > 0 ? (stats.RED / total) * 100 : 50
  const bluePercent = total > 0 ? (stats.BLUE / total) * 100 : 50
  
  // Area percentages (for visual bar if we wanted, or just display value)
  const totalArea = boostedRedArea + boostedBlueArea
  const redAreaPercent = totalArea > 0 ? (boostedRedArea / totalArea) * 100 : 50
  const blueAreaPercent = totalArea > 0 ? (boostedBlueArea / totalArea) * 100 : 50

  if (loading) return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 animate-pulse">
        <div className="h-4 w-24 bg-white/10 rounded mb-4" />
        <div className="h-4 w-full bg-white/10 rounded-full mb-4" />
        <div className="flex justify-between">
            <div className="h-8 w-16 bg-white/10 rounded" />
            <div className="h-8 w-16 bg-white/10 rounded" />
        </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/40">阵营战况</h2>
        {userFaction && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border font-medium",
            userFaction === 'RED' ? "text-red-400 border-red-500/30 bg-red-500/10" : "text-blue-400 border-blue-500/30 bg-blue-500/10"
          )}>
            我方: {userFaction === 'RED' ? '赤红先锋' : '蔚蓝联盟'}
          </span>
        )}
      </div>

      <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
        {/* Red Bar */}
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${redPercent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="bg-gradient-to-r from-red-600 to-red-500 relative group"
        >
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>

        {/* Blue Bar */}
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${bluePercent}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="bg-gradient-to-l from-blue-600 to-blue-500 relative"
        >
             <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </div>

      <div className="flex justify-between items-start mt-3">
        {/* Red Stats */}
        <div className={cn("text-left transition-all", userFaction === 'RED' ? "opacity-100" : "opacity-70")}>
          <div className="flex items-center gap-1.5 text-red-500 mb-0.5">
            <Shield className="w-4 h-4 fill-red-500/20" />
            <span className="font-bold text-lg leading-none">{stats.RED.toLocaleString()}</span>
          </div>
          <div className="text-xs text-red-400/50 font-mono flex items-center gap-2">
            <span>赤红先锋 {redPercent.toFixed(1)}%</span>
            {stats.bonus?.RED > 0 && (
                <span className="text-yellow-500 font-bold bg-yellow-500/10 px-1 rounded text-[10px]">+{stats.bonus.RED}% 收益</span>
            )}
          </div>
        </div>

        {/* Blue Stats */}
        <div className={cn("text-right transition-all", userFaction === 'BLUE' ? "opacity-100" : "opacity-70")}>
          <div className="flex items-center justify-end gap-1.5 text-blue-500 mb-0.5">
            <span className="font-bold text-lg leading-none">{stats.BLUE.toLocaleString()}</span>
            <Zap className="w-4 h-4 fill-blue-500/20" />
          </div>
          <div className="text-xs text-blue-400/50 font-mono flex items-center justify-end gap-2">
            {stats.bonus?.BLUE > 0 && (
                <span className="text-yellow-500 font-bold bg-yellow-500/10 px-1 rounded text-[10px]">+{stats.bonus.BLUE}% 收益</span>
            )}
            <span>蔚蓝联盟 {bluePercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Area Comparison */}
      <div className="mt-4 pt-4 border-t border-white/5">
         <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] uppercase tracking-wider text-white/40">领地势力 (含加成)</h3>
         </div>

         {/* Area Bars */}
         <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden flex shadow-inner opacity-80">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${redAreaPercent}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              className="bg-red-900/60 relative"
            >
               <div className="absolute inset-0 bg-gradient-to-r from-red-600/40 to-red-500/40" />
            </motion.div>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${blueAreaPercent}%` }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              className="bg-blue-900/60 relative"
            >
               <div className="absolute inset-0 bg-gradient-to-l from-blue-600/40 to-blue-500/40" />
            </motion.div>
         </div>

         <div className="flex justify-between items-start mt-2 text-[10px]">
            {/* Red Area */}
            <div className={cn("text-left", userFaction === 'RED' ? "opacity-100" : "opacity-60")}>
               <div className="flex items-center gap-1 text-red-300">
                  <Hexagon className="w-3 h-3" />
                  <span className="font-mono">{formatAreaFromHexCount(boostedRedArea).value} {formatAreaFromHexCount(boostedRedArea).unit}</span>
               </div>
            </div>

            {/* Blue Area */}
            <div className={cn("text-right", userFaction === 'BLUE' ? "opacity-100" : "opacity-60")}>
               <div className="flex items-center justify-end gap-1 text-blue-300">
                  <span className="font-mono">{formatAreaFromHexCount(boostedBlueArea).value} {formatAreaFromHexCount(boostedBlueArea).unit}</span>
                  <Hexagon className="w-3 h-3" />
               </div>
            </div>
         </div>
      </div>
    </div>
  )
}
