"use client"

import React, { useState, useEffect } from "react"
import { TrendingUp, TrendingDown, Flame } from "lucide-react"

// ============================================================
// ScoreChangeToast — Score Change Notification
//
// Animated toast showing score gains (green ↑) or losses (red ↓)
// with hot zone multiplier explanation.
// ============================================================

interface ScoreChangeToastProps {
    /** Score change amount (positive = gain, negative = loss) */
    amount: number
    /** Whether this is a hot zone */
    isHotZone?: boolean
    /** Reason for the score change */
    reason?: "capture" | "loss" | "attack"
    /** Duration in ms before auto-dismiss (0 = manual) */
    duration?: number
    /** Called when toast is dismissed */
    onDismiss?: () => void
    /** Whether toast is visible */
    isVisible: boolean
}

export function ScoreChangeToast({
    amount,
    isHotZone = false,
    reason = "capture",
    duration = 3000,
    onDismiss,
    isVisible,
}: ScoreChangeToastProps) {
    const [isAnimating, setIsAnimating] = useState(false)
    const [isExiting, setIsExiting] = useState(false)

    const isGain = amount > 0

    useEffect(() => {
        if (isVisible) {
            setIsAnimating(true)
            setIsExiting(false)

            if (duration > 0) {
                const timer = setTimeout(() => {
                    setIsExiting(true)
                    setTimeout(() => {
                        setIsAnimating(false)
                        onDismiss?.()
                    }, 400)
                }, duration)
                return () => clearTimeout(timer)
            }
        }
    }, [isVisible, duration, onDismiss])

    if (!isVisible && !isAnimating) return null

    const getReasonText = () => {
        switch (reason) {
            case "capture":
                return isHotZone
                    ? "占领热门区域 ×0.5 积分（争夺惩罚）"
                    : "成功占领领地"
            case "loss":
                return isHotZone
                    ? "失去热门区域，扣除50%积分"
                    : "失去领地，扣除50%积分"
            case "attack":
                return "攻击敌方领地"
            default:
                return ""
        }
    }

    return (
        <div
            className={`
        fixed top-20 left-1/2 z-50 -translate-x-1/2
        transition-all duration-400 ease-out
        ${isExiting
                    ? isGain
                        ? "opacity-0 -translate-y-8"
                        : "opacity-0 translate-y-8"
                    : "opacity-100 translate-y-0"
                }
        ${!isAnimating ? "hidden" : ""}
      `}
        >
            <div
                className={`
          flex items-center gap-3 rounded-2xl px-5 py-3
          border backdrop-blur-xl shadow-xl
          ${isGain
                        ? "border-emerald-500/30 bg-emerald-950/80 shadow-emerald-500/20"
                        : "border-red-500/30 bg-red-950/80 shadow-red-500/20"
                    }
        `}
            >
                {/* Icon */}
                <div
                    className={`
            flex h-10 w-10 items-center justify-center rounded-full
            ${isGain ? "bg-emerald-500/20" : "bg-red-500/20"}
          `}
                >
                    {isGain ? (
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                    ) : (
                        <TrendingDown className="h-5 w-5 text-red-400" />
                    )}
                </div>

                {/* Content */}
                <div>
                    {/* Score amount */}
                    <div className="flex items-center gap-2">
                        <span
                            className={`
                text-xl font-bold tabular-nums
                ${isGain ? "text-emerald-400" : "text-red-400"}
              `}
                        >
                            {isGain ? "+" : ""}
                            {amount}
                        </span>

                        {isHotZone && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/20 px-1.5 py-0.5">
                                <Flame className="h-3 w-3 text-orange-400" />
                                <span className="text-[10px] font-medium text-orange-300">
                                    ×0.5
                                </span>
                            </span>
                        )}
                    </div>

                    {/* Reason text */}
                    <p
                        className={`
              text-xs
              ${isGain ? "text-emerald-400/60" : "text-red-400/60"}
            `}
                    >
                        {getReasonText()}
                    </p>
                </div>
            </div>

            {/* Animation keyframes */}
            <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          * {
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
        </div>
    )
}
