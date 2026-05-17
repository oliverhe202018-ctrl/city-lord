"use client"

import React from "react"
import { useTheme } from "@/components/citylord/theme/theme-provider"
import { useCity } from "@/contexts/CityContext"

export interface ThemedGradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "success" | "danger"
  size?: "sm" | "md" | "lg"
  children: React.ReactNode
}

export function ThemedGradientButton({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ThemedGradientButtonProps) {
  const { themeId } = useTheme()
  const { currentCity } = useCity()

  const getGradientColors = () => {
    if (themeId === "cyberpunk") {
      switch (variant) {
        case "primary":
          return "from-purple-500 via-pink-500 to-red-500"
        case "secondary":
          return "from-cyan-500 via-blue-500 to-purple-500"
        case "success":
          return "from-green-400 via-emerald-500 to-teal-500"
        case "danger":
          return "from-red-500 via-rose-500 to-pink-500"
      }
    } else if (themeId === "nature") {
      switch (variant) {
        case "primary":
          return "from-green-400 via-emerald-500 to-teal-500"
        case "secondary":
          return "from-yellow-400 via-orange-400 to-amber-500"
        case "success":
          return "from-green-500 via-lime-500 to-green-400"
        case "danger":
          return "from-orange-500 via-red-500 to-rose-500"
      }
    } else {
      // 使用城市主题色
      const primary = currentCity?.themeColors.primary || "#3b82f6"
      const secondary = currentCity?.themeColors.secondary || "#8b5cf6"

      switch (variant) {
        case "primary":
          return `from-[${primary}] to-[${secondary}]`
        case "secondary":
          return `from-[${secondary}] to-[${primary}]`
        case "success":
          return "from-green-500 to-emerald-500"
        case "danger":
          return "from-red-500 to-rose-500"
      }
    }
  }

  const getShadowColor = () => {
    if (themeId === "cyberpunk") {
      return "shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:shadow-[0_0_30px_rgba(168,85,247,0.7)]"
    } else if (themeId === "nature") {
      return "shadow-[0_0_20px_rgba(34,197,94,0.5)] hover:shadow-[0_0_30px_rgba(34,197,94,0.7)]"
    } else {
      const color = currentCity?.themeColors.primary || "#3b82f6"
      return `shadow-[0_0_20px_${color}50] hover:shadow-[0_0_30px_${color}70]`
    }
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  }

  return (
    <button
      className={`
        relative overflow-hidden rounded-xl font-semibold text-white
        transition-all duration-300
        hover:scale-105 active:scale-95
        ${sizeClasses[size]}
        ${getShadowColor()}
        ${className}
      `}
      style={{
        background: `linear-gradient(135deg, ${getGradientColors()})`,
      } as React.CSSProperties}
      {...props}
    >
      {/* 光泽效果 */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 translate-x-[-100%] group-hover:animate-[shimmer_2s_infinite]" />

      {/* 内部内容 */}
      <span className="relative z-10">{children}</span>
    </button>
  )
}

export interface ThemedCardProps {
  children: React.ReactNode
  className?: string
  variant?: "default" | "glow" | "bordered"
  interactive?: boolean
}

export function ThemedCard({
  children,
  className = "",
  variant = "default",
  interactive = false,
}: ThemedCardProps) {
  const { theme } = useTheme()
  const { currentCity } = useCity()

  const getCardStyle = () => {
    const baseStyle = "rounded-2xl backdrop-blur-xl border transition-all duration-300"

    if (variant === "default") {
      return `${baseStyle} bg-gradient-to-br from-black/60 to-black/40 border-white/10`
    } else if (variant === "glow") {
      const glowColor = currentCity?.themeColors.primary || "#3b82f6"
      return `${baseStyle} bg-black/60 border-2 border-white/20 shadow-[0_0_30px_${glowColor}30]`
    } else if (variant === "bordered") {
      const borderColor = currentCity?.themeColors.primary || "#3b82f6"
      return `${baseStyle} bg-black/40 border-2 border-[${borderColor}]`
    }

    return baseStyle
  }

  return (
    <div
      className={`
        ${getCardStyle()}
        ${interactive ? "hover:scale-[1.02] hover:shadow-lg cursor-pointer" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

// 主题感知的进度条
export interface ThemedProgressBarProps {
  progress: number
  size?: "sm" | "md" | "lg"
  animated?: boolean
  showPercentage?: boolean
  className?: string
}

export function ThemedProgressBar({
  progress,
  size = "md",
  animated = true,
  showPercentage = false,
  className = "",
}: ThemedProgressBarProps) {
  const { theme } = useTheme()
  const { currentCity } = useCity()

  const getGradient = () => {
    if (theme.id === "cyberpunk") {
      return "from-purple-500 via-pink-500 to-red-500"
    } else if (theme.id === "nature") {
      return "from-green-400 via-emerald-500 to-teal-500"
    } else {
      return `from-[${currentCity?.themeColors.primary}] to-[${currentCity?.themeColors.secondary}]`
    }
  }

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  }

  return (
    <div className={`relative ${className}`}>
      {showPercentage && (
        <p className="mb-1 text-xs text-white/70">{Math.round(progress)}%</p>
      )}
      <div className={`relative w-full overflow-hidden rounded-full bg-white/10 ${sizeClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            animated ? "animate-pulse" : ""
          }`}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: `linear-gradient(90deg, ${getGradient()})`,
            boxShadow: `0 0 10px ${currentCity?.themeColors.primary}50`,
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}
