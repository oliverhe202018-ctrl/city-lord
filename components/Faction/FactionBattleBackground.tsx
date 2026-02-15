"use client"

import React, { useMemo } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface Props {
  userFaction: 'blue' | 'red'
  blue_area: number
  red_area: number
  isLoading?: boolean
  className?: string
}

export function FactionBattleBackground({ 
  userFaction, 
  blue_area, 
  red_area, 
  isLoading = false,
  className 
}: Props) {
  
  // 1. Calculate Percentages
  const { bluePercent, redPercent, isDraw } = useMemo(() => {
    const total = blue_area + red_area
    if (total === 0) return { bluePercent: 50, redPercent: 50, isDraw: true }
    
    const blue = (blue_area / total) * 100
    // Keep within 5-95% to avoid UI breaking completely
    const clampedBlue = Math.max(5, Math.min(95, blue))
    
    return {
      bluePercent: clampedBlue,
      redPercent: 100 - clampedBlue,
      isDraw: Math.abs(blue - 50) < 0.1
    }
  }, [blue_area, red_area])

  // 2. Dynamic Angle Calculation
  // Formula: deg = 90 + (redPercent - 50) * 0.5
  // If Red is dominant (e.g. 80%), angle = 90 + 15 = 105deg (Tilts line to compress Blue)
  // If Blue is dominant (Red 20%), angle = 90 - 15 = 75deg (Tilts line to compress Red)
  const splitAngle = 90 + (redPercent - 50) * 0.5

  // 3. Dynamic Font Size Calculation
  const getFontSize = (percent: number) => {
    // Map 0-100 to appropriate Tailwind classes or rem values
    if (percent < 20) return "text-sm"
    if (percent < 40) return "text-base"
    if (percent < 60) return "text-lg"
    if (percent < 80) return "text-xl"
    return "text-2xl"
  }

  const getOpacity = (percent: number) => {
    return percent < 30 ? 0.7 : 1
  }

  return (
    <div className={cn("relative w-full h-full overflow-hidden select-none bg-black", className)}>
      
      {/* ================= Layer 1: Red Vanguard (Left/Bottom Layer) ================= */}
      {/* Covers the whole background initially */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center overflow-hidden">
         {/* Noise Texture */}
         <div className="absolute inset-0 opacity-20 bg-[url('/noise.png')] mix-blend-overlay pointer-events-none" />
      </div>

      {/* ================= Layer 2: Blue Alliance (Right/Top Layer) ================= */}
      {/* Masked to show only the right side */}
      <div 
        className="absolute inset-0 bg-gradient-to-bl from-blue-600 to-blue-900 flex items-center justify-center overflow-hidden"
        style={{
          maskImage: `linear-gradient(${splitAngle}deg, transparent ${redPercent}%, black ${redPercent}%)`,
          WebkitMaskImage: `linear-gradient(${splitAngle}deg, transparent ${redPercent}%, black ${redPercent}%)`
        }}
      >
        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-20 bg-[url('/noise.png')] mix-blend-overlay pointer-events-none" />
      </div>

      {/* ================= Layer 3: The Split Line (Highlight) ================= */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: `linear-gradient(${splitAngle}deg, transparent calc(${redPercent}% - 2px), rgba(255,255,255,0.8) ${redPercent}%, transparent calc(${redPercent}% + 2px))`
        }}
      >
        {/* Glow effect for the line */}
         <div 
          className="absolute inset-0 opacity-50"
          style={{
            background: `linear-gradient(${splitAngle}deg, transparent calc(${redPercent}% - 4px), rgba(255,255,255,0.3) ${redPercent}%, transparent calc(${redPercent}% + 4px))`
          }}
        />
      </div>

      {/* ================= Layer 4: Text Content ================= */}
      
      {/* Red Faction Text */}
      <motion.div 
        className={cn(
          "absolute top-4 left-6 z-20 font-black text-white tracking-widest whitespace-nowrap drop-shadow-lg flex flex-col items-start gap-1",
          getFontSize(redPercent)
        )}
        style={{ 
          opacity: getOpacity(redPercent)
        }}
        animate={{ scale: redPercent > 50 ? 1.05 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <span>赤红先锋</span>
        <div className="flex flex-col items-start">
          <span className="text-xs opacity-80 font-normal">{Math.round(redPercent)}%</span>
          {userFaction === 'red' && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-sm mt-0.5 font-normal tracking-normal text-white/90">
              我的阵营
            </span>
          )}
        </div>
      </motion.div>

      {/* Blue Faction Text */}
      <motion.div 
        className={cn(
          "absolute top-4 right-6 z-20 font-black text-white tracking-widest whitespace-nowrap drop-shadow-lg flex flex-col items-end gap-1",
          getFontSize(bluePercent)
        )}
        style={{ 
          opacity: getOpacity(bluePercent)
        }}
        animate={{ scale: bluePercent > 50 ? 1.05 : 1 }}
        transition={{ duration: 0.5 }}
      >
        <span>蔚蓝联盟</span>
        <div className="flex flex-col items-end">
          <span className="text-xs opacity-80 font-normal">{Math.round(bluePercent)}%</span>
          {userFaction === 'blue' && (
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-sm mt-0.5 font-normal tracking-normal text-white/90">
              我的阵营
            </span>
          )}
        </div>
      </motion.div>

      {/* Title (Optional, keeping it subtle or removing as per 'remove Scanning text' instruction, but 'Faction Battle' title might still be wanted? User said remove 'Scanning...', didn't say remove title. I will keep a subtle title at top if needed, or just leave it clean. The requirement 3 says 'Remove scanning text', implies keep others? But Requirement 3 also says 'Display faction names'. I'll stick to just Faction names to be safe and clean.) */}
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-30 animate-pulse" />
      )}

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)] pointer-events-none z-10" />
      
    </div>
  )
}
