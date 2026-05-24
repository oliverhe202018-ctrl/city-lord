"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocationStore } from "@/store/useLocationStore"
import type { GeoPoint } from "@/hooks/useSafeGeolocation"
import { toast } from "sonner"

interface CountdownOverlayProps {
  onComplete: (anchorPoint?: GeoPoint) => void
}

/**
 * CountdownOverlay — 跑步预热倒计时（全生命周期预热机制重构版）
 *
 * 核心逻辑：
 *   1. 倒计时 4.5 秒期间，后台 GPS 预热流持续充实 prewarmHistory
 *   2. 倒计时结束时，从 prewarmHistory 中检索黄金坐标点（accuracy ≤ 15m）
 *   3. 若找到黄金点，立即传递给 onComplete() 作为绝对起点
 *   4. 若 30 秒内无满足条件的点，进入悬停状态 + 60 秒超时强制放行
 */

/** 收敛精度门槛（米）— 严格保持 15 米 */
const CONVERGENCE_ACCURACY_M = 15;

/** 超时强制放行时间（ms） */
const TIMEOUT_GUARD_MS = 60_000; // 60 秒

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState<string>("READY")
  const [isHovering, setIsHovering] = useState(false)
  const [hoverMessage, setHoverMessage] = useState("")
  const completedRef = useRef(false)
  const timeoutGuardRef = useRef<NodeJS.Timeout | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Subscribe to prewarm history length for UI feedback
  const prewarmHistoryLength = useLocationStore((s: any) => s.prewarmHistory.length)

  // --- Countdown sequence ---
  useEffect(() => {
    // Sequence: READY (0ms) -> 3 (1000ms) -> 2 (2000ms) -> 1 (3000ms) -> GO (4000ms) -> Complete (4500ms)
    const timers: NodeJS.Timeout[] = []

    timers.push(setTimeout(() => setCount("3"), 1000))
    timers.push(setTimeout(() => setCount("2"), 2000))
    timers.push(setTimeout(() => setCount("1"), 3000))
    timers.push(setTimeout(() => setCount("GO!"), 4000))
    timers.push(setTimeout(() => {
      if (!completedRef.current) {
        handleCountdownComplete()
      }
    }, 4500))

    return () => {
      timers.forEach(clearTimeout)
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeoutGuardRef.current) clearTimeout(timeoutGuardRef.current)
    }
  }, [])

  /**
   * 倒计时结束处理：检索黄金坐标点
   */
  const handleCountdownComplete = () => {
    if (completedRef.current) return

    const anchor = useLocationStore.getState().getBestAccuracySample(CONVERGENCE_ACCURACY_M)

    if (anchor) {
      // 找到黄金坐标点，直接放行
      completedRef.current = true
      onComplete(anchor)
    } else {
      // 进入悬停与降级逻辑
      setIsHovering(true)
      setHoverMessage("GPS 信号弱，正在深度收敛...")
      toast.warning("GPS 信号弱，正在深度收敛...")

      // 开启 60 秒强制放行定时器
      timeoutGuardRef.current = setTimeout(() => {
        if (!completedRef.current) {
          console.warn('[SmartPrewarm] Timeout guard triggered (60s), forcing release')
          setHoverMessage("信号收敛超时，使用最佳可用点启动")
          toast.info("信号收敛超时，使用最佳可用点启动")

          // 强制放行：使用 prewarmHistory 中精度最高的点（不限精度门槛）
          const bestAvailable = getBestAvailablePoint()
          completedRef.current = true
          if (bestAvailable) {
            onComplete(bestAvailable)
          } else {
            // 极端情况：无任何点，使用当前 location
            const currentLoc = useLocationStore.getState().location
            if (currentLoc) {
              onComplete(currentLoc)
            } else {
              // 强制放行但无任何定位，防止死锁
              onComplete(undefined)
            }
          }
        }
      }, TIMEOUT_GUARD_MS)

      // 启动轮询：每 500ms 检查一次是否有满足条件的点
      pollIntervalRef.current = setInterval(() => {
        if (completedRef.current) return
        const freshAnchor = useLocationStore.getState().getBestAccuracySample(CONVERGENCE_ACCURACY_M)
        if (freshAnchor) {
          completedRef.current = true
          setIsHovering(false)
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          if (timeoutGuardRef.current) clearTimeout(timeoutGuardRef.current)
          onComplete(freshAnchor)
        }
      }, 500)
    }
  }

  /**
   * 获取 prewarmHistory 中精度最高的点（不限精度门槛，用于超时强制放行）
   */
  const getBestAvailablePoint = (): GeoPoint | null => {
    const state = useLocationStore.getState()
    const history = state.prewarmHistory
    if (history.length === 0) return null

    let best = history[0]
    for (let i = 1; i < history.length; i++) {
      if ((history[i].accuracy ?? Infinity) < (best.accuracy ?? Infinity)) {
        best = history[i]
      }
    }
    return best
  }

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

      {/* GPS convergence indicator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 flex flex-col items-center gap-2"
      >
        <p className="text-xl font-bold text-white/80 tracking-[0.2em] uppercase">
          正在前往战场...
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-sm text-white/50">
            {isHovering ? hoverMessage : `GPS 校准中... (${prewarmHistoryLength} 预热样本)`}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
