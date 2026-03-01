"use client"

import React from "react"

// ============================================================
// TerritoryHPBar — Territory Health Progress Bar
//
// Renders a gradient progress bar (green → yellow → red)
// with HP text and low-HP pulse animation.
// Uses transform: scaleX() for GPU-accelerated rendering.
// ============================================================

interface TerritoryHPBarProps {
    /** Current HP (0–1000) */
    hp: number
    /** Maximum HP (default 1000) */
    maxHp?: number
    /** Size variant */
    size?: "sm" | "md" | "lg"
    /** Show numeric label */
    showLabel?: boolean
    /** Additional CSS classes */
    className?: string
}

export function TerritoryHPBar({
    hp,
    maxHp = 1000,
    size = "md",
    showLabel = true,
    className = "",
}: TerritoryHPBarProps) {
    const ratio = Math.max(0, Math.min(1, hp / maxHp))
    const percent = Math.round(ratio * 100)

    // Color based on HP percentage
    const getBarColor = () => {
        if (percent > 60) return "from-emerald-400 to-green-500"
        if (percent > 30) return "from-yellow-400 to-amber-500"
        return "from-red-400 to-rose-600"
    }

    const getGlowColor = () => {
        if (percent > 60) return "shadow-emerald-500/40"
        if (percent > 30) return "shadow-amber-500/40"
        return "shadow-red-500/40"
    }

    const sizeConfig = {
        sm: { height: "h-1.5", text: "text-[10px]", gap: "gap-1" },
        md: { height: "h-2.5", text: "text-xs", gap: "gap-1.5" },
        lg: { height: "h-3.5", text: "text-sm", gap: "gap-2" },
    }

    const config = sizeConfig[size]
    const isLow = percent <= 20
    const isCritical = percent <= 10

    return (
        <div className={`flex items-center ${config.gap} ${className}`}>
            {/* Progress bar container */}
            <div
                className={`relative flex-1 overflow-hidden rounded-full bg-white/10 ${config.height}`}
            >
                {/* Background track */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-white/5 to-white/[0.02]" />

                {/* Fill bar — GPU accelerated with scaleX */}
                <div
                    className={`
            absolute inset-y-0 left-0 right-0 origin-left rounded-full
            bg-gradient-to-r ${getBarColor()}
            shadow-sm ${getGlowColor()}
            transition-transform duration-500 ease-out
            ${isLow ? "animate-hp-pulse" : ""}
          `}
                    style={{
                        transform: `scaleX(${ratio})`,
                        willChange: isLow ? "transform" : "auto",
                    }}
                />

                {/* Shine effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent opacity-60" />
            </div>

            {/* HP numeric label */}
            {showLabel && (
                <span
                    className={`
            min-w-[3.5rem] text-right font-mono font-medium tabular-nums
            ${config.text}
            ${isCritical ? "text-red-400 animate-pulse" : "text-white/70"}
          `}
                >
                    {hp}/{maxHp}
                </span>
            )}

            {/* Inline style for pulse animation + prefers-reduced-motion */}
            <style jsx>{`
        @keyframes hp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .animate-hp-pulse {
          animation: hp-pulse 1.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-hp-pulse {
            animation: none;
          }
        }
      `}</style>
        </div>
    )
}
