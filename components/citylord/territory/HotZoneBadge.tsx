"use client"

import React, { useState } from "react"
import { Flame, TrendingUp, AlertTriangle, X } from "lucide-react"

// ============================================================
// HotZoneBadge — Hot Zone Indicator Badge
//
// Shows a 🔥 animated badge for territories that are hot zones
// (>=2 owner changes in 7 days). Tap to show rules tooltip.
// ============================================================

interface HotZoneBadgeProps {
    /** Whether this territory is a hot zone */
    isHotZone: boolean
    /** Number of owner changes */
    ownerChangeCount?: number
    /** Size variant */
    size?: "sm" | "md" | "lg"
    /** Show as inline pill or floating badge */
    variant?: "pill" | "floating"
    /** Additional CSS classes */
    className?: string
}

export function HotZoneBadge({
    isHotZone,
    ownerChangeCount = 0,
    size = "md",
    variant = "pill",
    className = "",
}: HotZoneBadgeProps) {
    const [showTooltip, setShowTooltip] = useState(false)

    if (!isHotZone) return null

    const sizeConfig = {
        sm: { icon: "h-3 w-3", text: "text-[10px]", padding: "px-1.5 py-0.5" },
        md: { icon: "h-3.5 w-3.5", text: "text-xs", padding: "px-2 py-1" },
        lg: { icon: "h-4 w-4", text: "text-sm", padding: "px-2.5 py-1.5" },
    }

    const config = sizeConfig[size]

    return (
        <div className={`relative inline-flex ${className}`}>
            {/* Badge */}
            <button
                onClick={() => setShowTooltip(!showTooltip)}
                className={`
          inline-flex items-center gap-1 rounded-full
          ${config.padding}
          bg-gradient-to-r from-orange-500/30 to-red-500/30
          border border-orange-500/40
          backdrop-blur-sm
          transition-all duration-200
          hover:from-orange-500/40 hover:to-red-500/40
          active:scale-95
          ${variant === "floating" ? "shadow-lg shadow-orange-500/20" : ""}
        `}
            >
                <Flame className={`${config.icon} text-orange-400 animate-flame`} />
                <span className={`${config.text} font-medium text-orange-300`}>
                    热门区域
                </span>
            </button>

            {/* Tooltip — Rules Overlay */}
            {showTooltip && (
                <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2">
                    <div className="rounded-2xl border border-orange-500/30 bg-[#0f172a]/95 p-4 shadow-xl shadow-orange-500/10 backdrop-blur-xl">
                        {/* Header */}
                        <div className="mb-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Flame className="h-4 w-4 text-orange-400" />
                                <span className="text-sm font-bold text-orange-300">
                                    热门区域规则
                                </span>
                            </div>
                            <button
                                onClick={() => setShowTooltip(false)}
                                className="rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>

                        {/* Rules list */}
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-yellow-400" />
                                <p className="text-xs leading-relaxed text-white/70">
                                    占领积分 <span className="font-semibold text-yellow-400">×0.5</span>（争夺惩罚）
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                                <p className="text-xs leading-relaxed text-white/70">
                                    失去领地扣除原积分的{" "}
                                    <span className="font-semibold text-red-400">50%</span>
                                </p>
                            </div>
                        </div>

                        {/* Change count */}
                        <div className="mt-3 rounded-lg bg-white/5 px-3 py-2">
                            <p className="text-[10px] text-white/40">
                                7天内易主 <span className="font-mono text-orange-400">{ownerChangeCount}</span> 次
                            </p>
                        </div>

                        {/* Arrow */}
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rotate-45 border-b border-r border-orange-500/30 bg-[#0f172a]/95 h-3 w-3" />
                    </div>
                </div>
            )}

            {/* Flame animation style */}
            <style jsx>{`
        @keyframes flame {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.1) rotate(-3deg); }
          50% { transform: scale(1.05) rotate(2deg); }
          75% { transform: scale(1.15) rotate(-2deg); }
        }
        .animate-flame {
          animation: flame 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-flame {
            animation: none;
          }
        }
      `}</style>
        </div>
    )
}
