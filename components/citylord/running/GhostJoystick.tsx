"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"

interface GhostJoystickProps {
  onMove: (vector: { x: number; y: number }) => void
}

export function GhostJoystick({ onMove }: GhostJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  
  // Update loop
  useEffect(() => {
    // Only run if dragging or position is not zero (during reset animation)
    // But mainly while dragging.
    if (!isDragging && position.x === 0 && position.y === 0) return

    const interval = setInterval(() => {
      // Max radius defined by drag constraints.
      // Let's assume the container is 96px (w-24), knob is 40px (w-10).
      // Max travel is roughly (96-40)/2 = 28px. 
      // Let's normalize by 30px.
      const maxRadius = 30
      
      // Clamp values
      const rawX = position.x
      const rawY = position.y
      
      const x = Math.max(-1, Math.min(1, rawX / maxRadius))
      const y = Math.max(-1, Math.min(1, rawY / maxRadius))
      
      // Deadzone
      if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) return

      onMove({ x, y })
    }, 50) // Update every 50ms for smooth movement

    return () => clearInterval(interval)
  }, [position, isDragging, onMove])

  return (
    <div className="fixed bottom-40 right-6 z-[10000] flex flex-col items-center gap-2 pointer-events-auto">
      <div className="text-[10px] text-[#22c55e] font-mono font-bold bg-black/60 px-2 py-1 rounded border border-[#22c55e]/30">GHOST ON</div>
      <div 
        ref={containerRef}
        className="w-24 h-24 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center relative touch-none shadow-xl"
      >
        {/* Crosshair */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-full h-[1px] bg-white"></div>
            <div className="h-full w-[1px] bg-white absolute"></div>
        </div>

        <motion.div
          className="w-10 h-10 rounded-full bg-[#22c55e] shadow-[0_0_15px_rgba(34,197,94,0.5)] border-2 border-white/50 z-10 cursor-grab active:cursor-grabbing"
          drag
          dragConstraints={containerRef}
          dragElastic={0.1}
          dragMomentum={false}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={() => {
            setIsDragging(false)
            setPosition({ x: 0, y: 0 })
          }}
          onDrag={(event, info) => {
            setPosition({ x: info.offset.x, y: info.offset.y })
          }}
          animate={!isDragging ? { x: 0, y: 0 } : undefined}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
    </div>
  )
}
