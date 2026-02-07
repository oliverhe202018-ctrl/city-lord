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
  const { bluePercent, redPercent, winningFaction } = useMemo(() => {
    const total = blue_area + red_area
    if (total === 0) return { bluePercent: 50, redPercent: 50, winningFaction: null }
    
    const blue = (blue_area / total) * 100
    return {
      bluePercent: blue,
      redPercent: 100 - blue,
      winningFaction: blue_area > red_area ? 'blue' : (red_area > blue_area ? 'red' : null)
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

  // We can use a simpler approach with two absolute divs for "breathing" effect
  
  return (
    <div className={cn("relative w-full h-full overflow-hidden", className)}>
      {/* Base Background Layer - The Split */}
      <div 
        className="absolute inset-0 transition-all duration-1000 ease-in-out"
        style={{
          background: `linear-gradient(115deg, 
            ${blueColor} 0%, 
            ${blueColor} ${bluePercent - 5}%, 
            ${redColor} ${bluePercent + 5}%, 
            ${redColor} 100%)`
        }}
      />

      {/* Winning Faction "Breathing" / "Flow" Effect */}
      {winningFaction && (
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
