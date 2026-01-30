"use client"

import React, { useEffect, useState } from "react"
import { useCity } from "@/contexts/CityContext"
import { Swords, Shield, Compass, Users, Clock, Star } from "lucide-react"

/**
 * 挑战开始过渡动画组件
 * 提供全屏动画效果，增强挑战开始的仪式感
 */
export function ChallengeStartTransition({
  challenge,
  isActive,
  onComplete,
}: {
  challenge: {
    name: string
    type: string
    description: string
  }
  isActive: boolean
  onComplete: () => void
}) {
  const { currentCity } = useCity()
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter")
  const [particleCount, setParticleCount] = useState(0)

  // 挑战类型图标映射
  const challengeTypeIcons: Record<string, React.ElementType> = {
    conquest: Swords,
    defense: Shield,
    exploration: Compass,
    social: Users,
    daily: Clock,
  }

  const Icon = challengeTypeIcons[challenge.type] || Star

  useEffect(() => {
    if (!isActive) return

    // 进入阶段
    setPhase("enter")

    // 生成粒子
    const particleInterval = setInterval(() => {
      setParticleCount((prev) => Math.min(prev + 5, 100))
    }, 50)

    // 保持阶段
    const holdTimer = setTimeout(() => {
      setPhase("hold")
      clearInterval(particleInterval)
    }, 1500)

    // 退出阶段
    const exitTimer = setTimeout(() => {
      setPhase("exit")
      onComplete()
    }, 3500)

    return () => {
      clearInterval(particleInterval)
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
    }
  }, [isActive, onComplete])

  if (!isActive || !currentCity) return null

  return (
    <div className="fixed inset-0 z-[500] bg-slate-900 flex items-center justify-center">
      {/* 背景渐变动画 */}
      <div
        className="absolute inset-0 opacity-20 transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${currentCity.theme.primary} 0%, transparent 70%)`,
          animation: phase === "enter" ? "pulse-bg 1s ease-in-out" : "none",
        }}
      />

      {/* 粒子效果 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: particleCount }).map((_, i) => (
          <Particle
            key={i}
            color={currentCity.theme.primary}
            delay={i * 30}
            phase={phase}
          />
        ))}
      </div>

      {/* 中央内容 */}
      <div
        className={`relative z-10 transition-all duration-1000 ${
          phase === "enter"
            ? "scale-0 opacity-0"
            : phase === "hold"
            ? "scale-100 opacity-100"
            : "scale-150 opacity-0"
        }`}
      >
        {/* 图标 */}
        <div
          className={`w-32 h-32 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500 ${
            phase === "hold" ? "animate-bounce" : ""
          }`}
          style={{
            background: `linear-gradient(135deg, ${currentCity.theme.primary}40, ${currentCity.theme.secondary}30)`,
            boxShadow: `0 0 60px ${currentCity.theme.primary}50`,
          }}
        >
          <Icon className="w-16 h-16" style={{ color: currentCity.theme.primary }} />
        </div>

        {/* 挑战名称 */}
        <h1 className="text-4xl font-bold text-white mb-4 text-center">{challenge.name}</h1>

        {/* 挑战描述 */}
        {phase === "hold" && (
          <p className="text-lg text-white/70 text-center max-w-md mx-auto">
            {challenge.description}
          </p>
        )}

        {/* 开始提示 */}
        {phase === "hold" && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/60 animate-ping" />
            <span className="text-sm text-white/60">挑战已启动</span>
          </div>
        )}
      </div>

      {/* 环形光晕 */}
      <div
        className={`absolute rounded-full border-2 transition-all duration-1000 ${
          phase === "enter"
            ? "w-0 h-0 opacity-0"
            : phase === "hold"
            ? "w-96 h-96 opacity-50 animate-pulse"
            : "w-[200vw] h-[200vw] opacity-0"
        }`}
        style={{ borderColor: currentCity.theme.primary }}
      />

      {/* 底部渐变 */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-1000 ${
          phase === "enter" ? "w-0" : phase === "hold" ? "w-full" : "w-full"
        }`}
        style={{ background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})` }}
      />
    </div>
  )
}

/**
 * 粒子组件
 */
function Particle({ color, delay, phase }: { color: string; delay: number; phase: string }) {
  const [position, setPosition] = useState(() => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
  }))

  const [velocity] = useState(() => ({
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
  }))

  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    if (phase !== "hold") return

    const interval = setInterval(() => {
      setPosition((prev) => ({
        x: (prev.x + velocity.vx + 100) % 100,
        y: (prev.y + velocity.vy + 100) % 100,
      }))
      setOpacity((prev) => Math.max(0, prev - 0.02))
    }, 16)

    return () => clearInterval(interval)
  }, [phase, velocity])

  return (
    <div
      className="absolute w-1 h-1 rounded-full"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        backgroundColor: color,
        opacity,
        transform: `scale(${Math.random() * 2 + 1})`,
        transition: phase === "enter" ? "all 0.5s ease-out" : "none",
      }}
    />
  )
}

/**
 * 挑战完成动画组件
 */
export function ChallengeCompleteAnimation({
  challenge,
  isActive,
  onComplete,
}: {
  challenge: {
    name: string
    type: string
    rewards: { experience: number; points: number }
  }
  isActive: boolean
  onComplete: () => void
}) {
  const { currentCity } = useCity()
  const [phase, setPhase] = useState<"enter" | "celebrate" | "exit">("enter")
  const [showReward, setShowReward] = useState(false)

  useEffect(() => {
    if (!isActive) return

    setPhase("enter")

    const holdTimer = setTimeout(() => {
      setPhase("celebrate")
      setShowReward(true)
    }, 800)

    const exitTimer = setTimeout(() => {
      setPhase("exit")
      onComplete()
    }, 4000)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
    }
  }, [isActive, onComplete])

  if (!isActive || !currentCity) return null

  return (
    <div className="fixed inset-0 z-[500] bg-slate-900 flex items-center justify-center">
      {/* 背景粒子爆炸 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 50 }).map((_, i) => (
          <ConfettiParticle key={i} color={currentCity.theme.primary} delay={i * 20} />
        ))}
      </div>

      {/* 中央内容 */}
      <div
        className={`relative z-10 text-center transition-all duration-1000 ${
          phase === "enter" ? "scale-0 opacity-0" : phase === "celebrate" ? "scale-100 opacity-100" : "scale-150 opacity-0"
        }`}
      >
        {/* 胜利图标 */}
        <div
          className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8 ${
            phase === "celebrate" ? "animate-bounce" : ""
          }`}
          style={{
            background: `linear-gradient(135deg, #22c55e40, #16a34a30)`,
            boxShadow: `0 0 80px #22c55e50`,
          }}
        >
          <Star className="w-16 h-16 text-green-400" />
        </div>

        {/* 挑战完成标题 */}
        <h1 className="text-4xl font-bold text-white mb-4">挑战完成！</h1>
        <p className="text-lg text-white/70 mb-8">{challenge.name}</p>

        {/* 奖励展示 */}
        {showReward && (
          <div
            className={`space-y-4 transition-all duration-500 ${
              showReward ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/30">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <p className="text-sm text-yellow-400/80 mb-1">经验值</p>
                  <p className="text-3xl font-bold text-yellow-400">+{challenge.rewards.experience}</p>
                </div>
                <div className="w-px h-12 bg-yellow-500/30" />
                <div className="text-center">
                  <p className="text-sm text-purple-400/80 mb-1">积分</p>
                  <p className="text-3xl font-bold text-purple-400">+{challenge.rewards.points}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 彩带粒子组件
 */
function ConfettiParticle({ color, delay }: { color: string; delay: number }) {
  const [position, setPosition] = useState(() => ({
    x: 50,
    y: 50,
  }))
  const [velocity] = useState(() => ({
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 10 - 5,
  }))
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setPosition((prev) => ({
          x: prev.x + velocity.vx,
          y: prev.y + velocity.vy,
        }))
        setRotation((prev) => prev + 10)
      }, 16)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timer)
  }, [delay, velocity])

  return (
    <div
      className="absolute w-3 h-3"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        backgroundColor: color,
        transform: `rotate(${rotation}deg)`,
        borderRadius: Math.random() > 0.5 ? "50%" : "0",
        opacity: Math.max(0, 1 - Math.abs(50 - position.x) / 50),
      }}
    />
  )
}
