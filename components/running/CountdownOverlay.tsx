"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocationStore, GPS_START_ANCHOR_ACCURACY_METERS } from "@/store/useLocationStore"
import { getDistanceFromLatLonInMeters } from "@/lib/geometry-utils"
import type { GeoPoint } from "@/hooks/useSafeGeolocation"

interface CountdownOverlayProps {
  onComplete: (anchorPoint?: GeoPoint) => void
}

/**
 * CountdownOverlay — 跑步预热倒计时
 *
 * 核心改进：质量触发替代纯时间等待
 *   1. 倒计时期间持续消费 GPS warmup 缓冲区
 *   2. 收敛判定：连续 N 个点间距 < 20m 且精度 < 15m
 *   3. 条件满足时提取最后一个稳定点作为路径绝对起点
 *   4. 如果倒计时结束前 GPS 已收敛 → 立即触发 GO
 *   5. 如果倒计时结束时 GPS 未收敛 → 仍正常启动（降级）
 */

/** 收敛条件 — 最近连续 N 个点之间间距 < 20m 且精度 < CONVERGENCE_ACCURACY */
const CONVERGENCE_POINTS_REQUIRED = 3;
const CONVERGENCE_MAX_SPREAD_M = 20;
const CONVERGENCE_ACCURACY_M = 15;

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState<string>("READY")
  const convergedRef = useRef(false)
  const anchorPointRef = useRef<GeoPoint | undefined>(undefined)
  const completedRef = useRef(false)

  // Subscribe to warmup samples from global location store
  const warmupSamples = useLocationStore(s => s.warmupSamples)

  // --- Convergence check on every warmup sample update ---
  useEffect(() => {
    if (convergedRef.current || completedRef.current) return
    if (warmupSamples.length < CONVERGENCE_POINTS_REQUIRED) return

    // Take last N samples
    const recent = warmupSamples.slice(-CONVERGENCE_POINTS_REQUIRED)

    // Check all meet accuracy threshold
    const allAccurate = recent.every(
      p => p.accuracy != null && p.accuracy <= CONVERGENCE_ACCURACY_M
    )
    if (!allAccurate) return

    // Check mutual distances are within spread threshold
    let allClose = true
    for (let i = 1; i < recent.length; i++) {
      const dist = getDistanceFromLatLonInMeters(
        recent[i - 1].lat, recent[i - 1].lng,
        recent[i].lat, recent[i].lng
      )
      if (dist > CONVERGENCE_MAX_SPREAD_M) {
        allClose = false
        break
      }
    }

    if (allClose) {
      convergedRef.current = true
      anchorPointRef.current = recent[recent.length - 1]
      console.log(
        '[CountdownOverlay] ✅ GPS converged!',
        `accuracy=${anchorPointRef.current?.accuracy?.toFixed(1)}m`,
        `samples=${warmupSamples.length}`
      )
    }
  }, [warmupSamples])

  useEffect(() => {
    // Sequence: READY (0ms) -> 3 (1000ms) -> 2 (2000ms) -> 1 (3000ms) -> GO (4000ms) -> Complete (4500ms)
    // BUT: If GPS converges early AND we're past "1", skip to GO immediately

    const timers: NodeJS.Timeout[] = []

    timers.push(setTimeout(() => setCount("3"), 1000))
    timers.push(setTimeout(() => setCount("2"), 2000))
    timers.push(setTimeout(() => setCount("1"), 3000))
    timers.push(setTimeout(() => {
        setCount("GO!")
    }, 4000))
    timers.push(setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true
        onComplete(anchorPointRef.current)
      }
    }, 4500))

    // Early convergence fast-track: check every 200ms after "3" appears
    const earlyCheckId = setInterval(() => {
      if (completedRef.current) return
      if (convergedRef.current) {
        // Only fast-track after at minimum count "2" (i.e., at least 2s into countdown)
        // This gives the user visual feedback while GPS locks
        clearInterval(earlyCheckId)
        setCount("GO!")
        setTimeout(() => {
          if (!completedRef.current) {
            completedRef.current = true
            onComplete(anchorPointRef.current)
          }
        }, 500)
      }
    }, 200)

    return () => {
      timers.forEach(clearTimeout)
      clearInterval(earlyCheckId)
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
          <div className={`w-2 h-2 rounded-full ${convergedRef.current ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
          <span className="text-sm text-white/50">
            {convergedRef.current ? 'GPS 信号已锁定' : `GPS 校准中... (${warmupSamples.length} 样本)`}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
