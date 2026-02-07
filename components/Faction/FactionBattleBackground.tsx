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
  
  // Calculate percentages
  const { bluePercent, redPercent, winningFaction, isDraw } = useMemo(() => {
    const total = blue_area + red_area
    // Fix Task 4: 0 vs 0 兜底显示 50/50，视为平局
    if (total === 0) return { bluePercent: 50, redPercent: 50, winningFaction: null, isDraw: true }
    
    const blue = (blue_area / total) * 100
    // 如果双方极其接近（误差小于0.1%），也视为平局
    const isDraw = Math.abs(blue - 50) < 0.1
    
    return {
      bluePercent: blue,
      redPercent: 100 - blue,
      winningFaction: isDraw ? null : (blue_area > red_area ? 'blue' : 'red'),
      isDraw
    }
  }, [blue_area, red_area])

  // Generate Conic Gradient
  // Blue starts at 0deg, Red takes the rest.
  // We want a split that rotates or is static? Static split based on territory is good.
  // To make it look "versus", maybe split diagonally? 
  // Conic gradient: `conic-gradient(from 0deg at 50% 50%, #3b82f6 0% ${bluePercent}%, #ef4444 ${bluePercent}% 100%)`
  // But hard edges are harsh. Let's add some blur or soft transition if possible, 
  // but CSS gradients are hard edged.
  // Actually, let's use a linear gradient for a cleaner "Battle Line" effect, or conic for "Surrounding".
  // Let's try Conic as requested for "Area" feel.
  
  const gradientStyle = {
    background: `conic-gradient(from 180deg at 50% 100%, 
      var(--color-blue) 0deg, 
      var(--color-blue) ${bluePercent * 1.8}deg, 
      var(--color-red) ${bluePercent * 1.8}deg, 
      var(--color-red) 360deg)`
    // Note: 180deg to 360deg is the visible semi-circle if we place it at bottom? 
    // Actually simpler: `conic-gradient(from 270deg at 50% 50%, ...)`
    // Let's stick to a full background conic.
    // blue is usually left, red right? 
    // Let's just use the percentage directly.
  }

  // Dynamic colors using Tailwind vars or fallbacks
  const blueColor = "rgba(59, 130, 246, 0.8)" // blue-500
  const redColor = "rgba(239, 68, 68, 0.8)"   // red-500
  const neutralColor = "rgba(100, 116, 139, 0.3)" // slate-500 (降低透明度)

  // 0数据时的特殊处理：降低饱和度，避免过于刺眼
  const isZeroData = blue_area === 0 && red_area === 0;
  const finalBlue = isZeroData ? "rgba(59, 130, 246, 0.4)" : blueColor;
  const finalRed = isZeroData ? "rgba(239, 68, 68, 0.4)" : redColor;

  return (
    <div className={cn("relative w-full h-full overflow-hidden pointer-events-none select-none", className)}>
      {/* Base Background Layer - The Split */}
      <div 
        className="absolute inset-0 transition-all duration-1000 ease-in-out z-0"
        style={{
          background: isDraw 
            ? `linear-gradient(135deg, ${finalBlue} 0%, ${neutralColor} 50%, ${finalRed} 100%)`
            : `linear-gradient(115deg, 
                ${finalBlue} 0%, 
                ${finalBlue} ${bluePercent - 5}%, 
                ${finalRed} ${bluePercent + 5}%, 
                ${finalRed} 100%)`
        }}
      />
      
      {/* 0数据时的提示文案 */}
      {isZeroData && (
        <div className="absolute inset-0 flex items-center justify-center z-10 opacity-30">
             <span className="text-[10px] font-mono text-white tracking-widest uppercase">TERRITORY SCANNING...</span>
        </div>
      )}

      {/* Winning Faction "Breathing" / "Flow" Effect */}
      {winningFaction && !isZeroData && (
        <motion.div
          className="absolute inset-0 z-10 mix-blend-overlay"
          animate={{ 
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.05, 1] 
          }}
          transition={{ 
            duration: 3, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          style={{
            background: winningFaction === 'blue' 
              ? `linear-gradient(115deg, rgba(255,255,255,0.4) 0%, transparent ${bluePercent}%, transparent 100%)`
              : `linear-gradient(115deg, transparent 0%, transparent ${bluePercent}%, rgba(255,255,255,0.4) 100%)`
          }}
        />
      )}

      {/* Noise / Texture Overlay (Optional for grit) */}
      <div className="absolute inset-0 opacity-20 bg-[url('/noise.png')] mix-blend-overlay pointer-events-none" />

      {/* Loading State Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 animate-pulse" />
      )}

      {/* Bottom Mask - Essential for integration */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0f1a] to-transparent z-10" />
      
      {/* Side Vignette for focus */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0f1a_100%)] opacity-60 z-10" />
    </div>
  )
}
