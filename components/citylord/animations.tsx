"use client"

import React from "react"

import { useEffect, useState, useCallback } from "react"

// ============================================================
// 1. Hex Capture Particle Explosion & Glow Effects
// ============================================================

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

interface HexCaptureEffectProps {
  isActive: boolean
  x: number
  y: number
  color?: string
  onComplete?: () => void
}

export function HexCaptureEffect({ 
  isActive, 
  x, 
  y, 
  color = "#22c55e",
  onComplete 
}: HexCaptureEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [glowIntensity, setGlowIntensity] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // Handle completion callback in a separate effect to avoid setState during render
  useEffect(() => {
    if (isComplete && onComplete) {
      onComplete()
      setIsComplete(false)
    }
  }, [isComplete, onComplete])

  useEffect(() => {
    if (!isActive) return

    // Reset completion state
    setIsComplete(false)

    // Create burst particles
    const newParticles: Particle[] = []
    const particleCount = 20

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5
      const speed = 2 + Math.random() * 4
      newParticles.push({
        id: i,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        maxLife: 1,
        size: 3 + Math.random() * 4,
        color,
      })
    }

    setParticles(newParticles)
    setGlowIntensity(1)

    // Animate particles
    const interval = setInterval(() => {
      setParticles(prev => {
        const updated = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.1, // gravity
          life: p.life - 0.03,
        })).filter(p => p.life > 0)
        
        if (updated.length === 0) {
          clearInterval(interval)
          setIsComplete(true)
        }
        return updated
      })
      setGlowIntensity(prev => Math.max(0, prev - 0.05))
    }, 16)

    return () => clearInterval(interval)
  }, [isActive, color])

  if (!isActive && particles.length === 0) return null

  return (
    <div 
      className="pointer-events-none absolute"
      style={{ left: x, top: y }}
    >
      {/* Glow effect */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 80,
          height: 80,
          background: `radial-gradient(circle, ${color}${Math.floor(glowIntensity * 80).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
          filter: `blur(${10 * glowIntensity}px)`,
        }}
      />
      
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x,
            top: p.y,
            width: p.size * p.life,
            height: p.size * p.life,
            backgroundColor: p.color,
            opacity: p.life,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}

      {/* Ring expansion */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
        style={{
          width: 60 + (1 - glowIntensity) * 100,
          height: 60 + (1 - glowIntensity) * 100,
          borderColor: color,
          opacity: glowIntensity,
        }}
      />
    </div>
  )
}

// ============================================================
// 2. Button Animation Components
// ============================================================

interface AnimatedButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "success" | "primary" | "danger" | "gold"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
  isSuccess?: boolean
  disabled?: boolean
  className?: string
}

export function AnimatedButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  isLoading = false,
  isSuccess = false,
  disabled = false,
  className = "",
}: AnimatedButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [showSuccessEffect, setShowSuccessEffect] = useState(false)

  useEffect(() => {
    if (isSuccess) {
      setShowSuccessEffect(true)
      const timer = setTimeout(() => setShowSuccessEffect(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [isSuccess])

  const variantStyles = {
    success: {
      base: "bg-[#22c55e] text-black",
      glow: "shadow-[0_0_20px_rgba(34,197,94,0.5)]",
      pulse: "bg-[#22c55e]",
    },
    primary: {
      base: "bg-cyan-500 text-black",
      glow: "shadow-[0_0_20px_rgba(6,182,212,0.5)]",
      pulse: "bg-cyan-500",
    },
    danger: {
      base: "bg-red-500 text-white",
      glow: "shadow-[0_0_20px_rgba(239,68,68,0.5)]",
      pulse: "bg-red-500",
    },
    gold: {
      base: "bg-yellow-500 text-black",
      glow: "shadow-[0_0_20px_rgba(234,179,8,0.5)]",
      pulse: "bg-yellow-500",
    },
  }

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  }

  const style = variantStyles[variant]

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      className={`
        relative overflow-hidden rounded-xl font-semibold
        transition-all duration-150 ease-out
        ${style.base}
        ${sizeStyles[size]}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${isPressed ? "scale-95" : "scale-100 hover:scale-[1.02]"}
        ${showSuccessEffect ? style.glow : ""}
        active:scale-95
        ${className}
      `}
    >
      {/* Ripple effect on success */}
      {showSuccessEffect && (
        <span className="absolute inset-0 animate-ping rounded-xl bg-white/30" />
      )}
      
      {/* Shimmer effect */}
      <span 
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
        style={{ 
          animation: showSuccessEffect ? 'shimmer 0.6s ease-out' : 'none' 
        }}
      />

      {/* Content */}
      <span className={`relative flex items-center justify-center gap-2 ${isLoading ? 'opacity-0' : ''}`}>
        {children}
      </span>

      {/* Loading spinner */}
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
    </button>
  )
}

// ============================================================
// 3. Interactive State Indicators
// ============================================================

interface GpsIndicatorProps {
  strength: 0 | 1 | 2 | 3 | 4 | 5
  isSearching?: boolean
}

export function GpsIndicator({ strength, isSearching = false }: GpsIndicatorProps) {
  const bars = [1, 2, 3, 4, 5]
  
  const getColor = () => {
    if (isSearching) return "bg-yellow-400"
    if (strength >= 4) return "bg-[#22c55e]"
    if (strength >= 2) return "bg-yellow-400"
    return "bg-red-400"
  }

  return (
    <div className="flex items-end gap-0.5">
      {bars.map((bar) => (
        <div
          key={bar}
          className={`
            w-1 rounded-sm transition-all duration-300
            ${bar <= strength ? getColor() : "bg-white/20"}
            ${isSearching && bar <= strength ? "animate-pulse" : ""}
          `}
          style={{ height: 4 + bar * 2 }}
        />
      ))}
      {isSearching && (
        <span className="ml-1 text-[10px] text-yellow-400 animate-pulse">搜索中</span>
      )}
    </div>
  )
}

interface PaceIndicatorProps {
  currentPace: number // seconds per km
  targetPace: number
  unit?: string
}

export function PaceIndicator({ currentPace, targetPace, unit = "/公里" }: PaceIndicatorProps) {
  const diff = currentPace - targetPace
  const isAhead = diff < 0
  const isBehind = diff > 30
  const isOnPace = !isAhead && !isBehind

  const formatPace = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-center">
        <p className="font-mono text-2xl font-bold text-white">
          {formatPace(currentPace)}
          <span className="ml-1 text-sm font-normal text-white/40">{unit}</span>
        </p>
      </div>
      
      {/* Status indicator */}
      <div className={`
        flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium
        ${isAhead ? "bg-[#22c55e]/20 text-[#22c55e]" : ""}
        ${isBehind ? "bg-red-500/20 text-red-400" : ""}
        ${isOnPace ? "bg-cyan-500/20 text-cyan-400" : ""}
      `}>
        {isAhead && (
          <>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span>快{formatPace(Math.abs(diff))}</span>
          </>
        )}
        {isBehind && (
          <>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <span>慢{formatPace(Math.abs(diff))}</span>
          </>
        )}
        {isOnPace && <span>配速稳定</span>}
      </div>
    </div>
  )
}

// ============================================================
// 4. Haptic Feedback Button Wrapper
// ============================================================

interface HapticButtonProps {
  children: React.ReactNode
  onClick?: () => void
  onLongPress?: () => void
  longPressDelay?: number
  className?: string
  hapticFeedback?: "light" | "medium" | "heavy"
  disabled?: boolean
}

export function HapticButton({
  children,
  onClick,
  onLongPress,
  longPressDelay = 500,
  className = "",
  hapticFeedback = "light",
  disabled = false,
}: HapticButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [longPressTriggered, setLongPressTriggered] = useState(false)
  const [pressProgress, setPressProgress] = useState(0)

  const triggerHaptic = useCallback(() => {
    // Vibration API for haptic feedback
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30],
      }
      navigator.vibrate(patterns[hapticFeedback])
    }
  }, [hapticFeedback])

  useEffect(() => {
    let timer: NodeJS.Timeout
    let progressTimer: NodeJS.Timeout

    if (isPressed && onLongPress && !longPressTriggered) {
      // Progress animation
      const startTime = Date.now()
      progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / longPressDelay, 1)
        setPressProgress(progress)
      }, 16)

      timer = setTimeout(() => {
        setLongPressTriggered(true)
        triggerHaptic()
        onLongPress()
      }, longPressDelay)
    }

    return () => {
      clearTimeout(timer)
      clearInterval(progressTimer)
    }
  }, [isPressed, onLongPress, longPressDelay, longPressTriggered, triggerHaptic])

  const handlePressStart = () => {
    if (disabled) return
    setIsPressed(true)
    setLongPressTriggered(false)
    setPressProgress(0)
    triggerHaptic()
  }

  const handlePressEnd = () => {
    if (!longPressTriggered && onClick && !disabled) {
      onClick()
    }
    setIsPressed(false)
    setLongPressTriggered(false)
    setPressProgress(0)
  }

  return (
    <button
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={() => {
        setIsPressed(false)
        setPressProgress(0)
      }}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      disabled={disabled}
      className={`
        relative overflow-hidden transition-all duration-150
        ${isPressed ? "scale-95" : "scale-100"}
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {/* Long press progress indicator */}
      {onLongPress && pressProgress > 0 && (
        <div 
          className="absolute inset-0 bg-white/20 transition-none"
          style={{ 
            clipPath: `inset(${100 - pressProgress * 100}% 0 0 0)`,
          }}
        />
      )}
      {children}
    </button>
  )
}

// ============================================================
// Animation Keyframes CSS (to be added to globals.css)
// ============================================================
export const animationStyles = `
/* Shimmer effect */
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Bounce effect for success */
@keyframes success-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* Glow pulse */
@keyframes glow-pulse {
  0%, 100% { 
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.5);
  }
  50% { 
    box-shadow: 0 0 40px rgba(34, 197, 94, 0.8);
  }
}

/* Hex capture flash */
@keyframes hex-flash {
  0% { opacity: 0; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
  100% { opacity: 0; transform: scale(1.5); }
}

/* GPS searching animation */
@keyframes gps-search {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* Button press feedback */
.btn-press {
  transform: scale(0.95);
  transition: transform 0.1s ease-out;
}

.btn-hover {
  transform: scale(1.02);
  transition: transform 0.15s ease-out;
}

/* Disabled state */
.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
`
