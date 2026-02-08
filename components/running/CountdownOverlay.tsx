"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface CountdownOverlayProps {
  onComplete: () => void
}

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    // Play sound immediately on mount
    const audio = new Audio('/sounds/countdown.mp3')
    audio.volume = 0.8
    audio.play().catch(e => console.error("Audio play failed:", e))

    const timer = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onComplete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
      <AnimatePresence mode="wait">
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.2, opacity: 1 }}
          exit={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center"
        >
          <span className="font-mono text-[12rem] font-black italic tracking-tighter text-[#22c55e] drop-shadow-[0_0_30px_rgba(34,197,94,0.6)]">
            {count}
          </span>
        </motion.div>
      </AnimatePresence>
      
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 text-xl font-bold text-white/80 tracking-[0.2em] uppercase"
      >
        正在前往战场...
      </motion.p>
    </div>
  )
}
