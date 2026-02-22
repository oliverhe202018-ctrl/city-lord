"use client"

import { Target, Trophy, Users, Loader2 } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface QuickEntryProps {
  onNavigate: (tab: "missions" | "social" | "running") => void
  missionCount?: number
  friendCount?: number
  rank?: number
}

export function QuickEntry({ onNavigate, missionCount = 0, friendCount = 0, rank = 42 }: QuickEntryProps) {
  const [isStarting, setIsStarting] = useState(false);

  // Basic debounce implementation
  const lastClickTimeRef = useRef(0);

  const handleGoClick = () => {
    const now = Date.now();
    // 800ms debounce
    if (now - lastClickTimeRef.current < 800) return;
    lastClickTimeRef.current = now;

    // Prevent re-trigger if already starting
    if (isStarting) return;

    setIsStarting(true);
    // Mimic initialization/locator delay
    setTimeout(() => {
      onNavigate("running");
      // Reset after a delay if they come back
      setTimeout(() => setIsStarting(false), 1000);
    }, 600);
  };

  return (
    <div className="grid grid-cols-3 gap-8">
      {/* Missions Entry - Shrunk 0.66x */}
      <button
        onClick={() => onNavigate("missions")}
        className="group relative mb-[90px] flex flex-col items-center rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl transition-all hover:border-cyan-400/30 hover:bg-cyan-400/5 active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2"
      >
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/20 transition-all group-hover:bg-cyan-400/30">
          <Target className="h-4 w-4 text-cyan-400" />
        </div>
        <span className="text-[10px] font-medium text-white">任务</span>
        {missionCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
            {missionCount}
          </span>
        )}
      </button>

      {/* Running Entry - Enlarged 1.3x GO Button */}
      <motion.button
        disabled={isStarting}
        onClick={handleGoClick}
        whileTap={!isStarting ? { scale: 0.92 } : {}}
        className={`group absolute -top-20 left-1/2 -translate-x-1/2 z-20 flex h-[104px] w-[104px] items-center justify-center rounded-full shadow-[0_4px_24px_hsl(var(--primary)/0.6)] transition-all outline-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-black disabled:opacity-80 disabled:cursor-not-allowed ${isStarting
          ? 'bg-primary/50' // Disabled/Locating state
          : 'bg-gradient-to-br from-primary to-primary/80 hover:brightness-110' // Normal state
          }`}
      >
        {/* Ripple Effects - Only show when NOT converting */}
        <AnimatePresence>
          {!isStarting && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" style={{ animationDuration: '2s' }}></span>
              <span className="absolute top-1/2 left-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-primary/20" style={{ animationDuration: '2s', animationDelay: '0.5s' }}></span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col items-center justify-center relative z-10">
          {isStarting ? (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center"
            >
              <Loader2 className="w-8 h-8 text-white animate-spin mb-1" />
              <span className="text-[10px] font-bold text-white">进入中..</span>
            </motion.div>
          ) : (
            <>
              <span className="text-xl font-black text-primary-foreground drop-shadow-md">GO!</span>
              <span className="text-xs font-bold text-primary-foreground/90 mt-0.5">跑步</span>
            </>
          )}
        </div>
      </motion.button>

      {/* Placeholder to maintain grid layout structure */}
      <div className="h-10 w-full" />

      {/* Social Entry - Shrunk 0.66x */}
      <button
        onClick={() => onNavigate("social")}
        className="group mb-[90px] flex flex-col items-center rounded-xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl transition-all hover:border-purple-400/30 hover:bg-purple-400/5 active:scale-[0.98]"
      >
        <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-purple-400/20 transition-all group-hover:bg-purple-400/30">
          <Users className="h-4 w-4 text-purple-400" />
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] font-medium text-white">好友</span>
          <span className="text-[8px] text-white/40">({friendCount})</span>
        </div>
      </button>
    </div>
  )
}
