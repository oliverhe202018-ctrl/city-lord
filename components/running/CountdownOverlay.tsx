"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface CountdownOverlayProps {
  onComplete: () => void
}

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState<string>("READY")

  useEffect(() => {
    // Sequence: READY (0ms) -> 3 (1000ms) -> 2 (2000ms) -> 1 (3000ms) -> GO (4000ms) -> Complete (4500ms)
    // Matches typical countdown audio structure
    
    const timers: NodeJS.Timeout[] = []

    timers.push(setTimeout(() => setCount("3"), 1000))
    timers.push(setTimeout(() => setCount("2"), 2000))
    timers.push(setTimeout(() => setCount("1"), 3000))
    timers.push(setTimeout(() => {
        setCount("GO!")
    }, 4000))
    timers.push(setTimeout(() => {
        onComplete()
    }, 4500))

    return () => {
      timers.forEach(clearTimeout)
    }
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
          <span className={`font-mono font-black italic tracking-tighter drop-shadow-[0_0_30px_rgba(34,197,94,0.6)] ${count === "READY" ? "text-6xl text-white" : "text-[12rem] text-[#22c55e]"}`}>
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
