"use client"

import React, { useEffect, useState, useRef } from "react"
import type { Achievement } from "@/types/city"
import { useCity } from "@/contexts/CityContext"
import { Trophy, Star, Crown, Medal, Award, Diamond, X, Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

/**
 * 成就解锁弹窗组件
 * 带有粒子庆祝效果和动画
 */
export function AchievementUnlockModal({
  achievement,
  isOpen,
  onClose,
  onClaim,
}: {
  achievement: Achievement
  isOpen: boolean
  onClose: () => void
  onClaim: () => void
}) {
  const { currentCity } = useCity()
  const [phase, setPhase] = useState<"enter" | "celebrate" | "exit">("enter")
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; vx: number; vy: number; color: string; size: number }>>([])

  const posterRef = useRef<HTMLDivElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setParticles([])
      return
    }

    setPhase("enter")

    // 生成粒子
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: 50,
      y: 50,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8 - 3,
      color: getRandomColor(),
      size: Math.random() * 6 + 4,
    }))
    setParticles(newParticles)

    // 庆祝阶段
    const celebrateTimer = setTimeout(() => {
      setPhase("celebrate")
    }, 500)

    // 自动关闭（如果没有操作）
    const autoCloseTimer = setTimeout(() => {
      handleClose()
    }, 5000)

    return () => {
      clearTimeout(celebrateTimer)
      clearTimeout(autoCloseTimer)
    }
  }, [isOpen])

  const handleClose = () => {
    setPhase("exit")
    setTimeout(onClose, 500)
  }

  const handleClaim = () => {
    onClaim()
    handleClose()
  }

  const handleGeneratePoster = async () => {
    if (!posterRef.current) return
    setIsGenerating(true)
    try {
      const { toPng } = await import("html-to-image")
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        style: { transform: "scale(1)", margin: "0" }
      })

      const link = document.createElement("a")
      link.download = `achievement-${achievement.id}.png`
      link.href = dataUrl
      link.click()

      if (navigator.share) {
        try {
          const blob = await (await fetch(dataUrl)).blob()
          const file = new File([blob], `achievement-${achievement.id}.png`, { type: "image/png" })
          await navigator.share({
            title: "城市领主 - 成就解锁",
            text: `我刚刚在《城市领主》解锁了【${achievement.name}】成就！`,
            files: [file]
          })

          // Reward user for sharing
          fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/social/share-reward`, {
            method: 'POST',
            body: JSON.stringify({ type: 'achievement', targetId: achievement.id }),
            headers: { 'Content-Type': 'application/json' }
          }).then(res => res.json()).then(data => {
            if (data.success) {
              toast.success(`分享成功！获得 ${data.rewards.coins} 金币，${data.rewards.exp} 经验！`, { icon: "🎉" })
            }
          }).catch(console.error)

        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            console.log("Native share cancelled by user")
          } else {
            console.error("Native share failed:", shareErr)
          }
        }
      }
    } catch (err) {
      console.error("Failed to generate poster", err)
      toast.error("海报生成失败")
    } finally {
      setIsGenerating(false)
    }
  }

  function getRandomColor() {
    const colors = [
      "#22c55e", // green
      "#eab308", // yellow
      "#3b82f6", // blue
      "#ec4899", // pink
      "#f97316", // orange
      "#8b5cf6", // purple
    ]
    return colors[Math.floor(Math.random() * colors.length)]
  }

  const getTierIcon = (tier: Achievement["tier"]) => {
    const icons: Record<Achievement["tier"], React.ElementType> = {
      bronze: Medal,
      silver: Award,
      gold: Trophy,
      platinum: Crown,
      diamond: Diamond,
    }
    return icons[tier] || Trophy
  }

  const getTierName = (tier: Achievement["tier"]) => {
    const names: Record<Achievement["tier"], string> = {
      bronze: "青铜",
      silver: "白银",
      gold: "黄金",
      platinum: "铂金",
      diamond: "钻石",
    }
    return names[tier] || "成就"
  }

  if (!isOpen || !currentCity) return null

  const TierIcon = getTierIcon(achievement.tier)
  const tierName = getTierName(achievement.tier)

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-md transition-opacity duration-500"
        onClick={handleClose}
      />

      {/* 弹窗内容 */}
      <div className="fixed inset-0 z-[401] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={`relative w-full max-w-md pointer-events-auto transform transition-all duration-500 ${phase === "enter" ? "scale-0 opacity-0" : phase === "celebrate" ? "scale-100 opacity-100" : "scale-110 opacity-0"
            }`}
        >
          {/* 粒子容器 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((particle) => (
              <ConfettiParticle
                key={particle.id}
                particle={particle}
                phase={phase}
                currentCity={currentCity}
              />
            ))}
          </div>

          {/* 主弹窗 */}
          <div
            ref={posterRef}
            className="relative p-8 rounded-3xl border backdrop-blur-xl overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${currentCity.theme.primary}30 0%, ${currentCity.theme.secondary}20 100%)`,
              borderColor: `${currentCity.theme.primary}50`,
              boxShadow: `0 0 100px ${currentCity.theme.primary}40`,
            }}
          >
            {/* 装饰光晕 */}
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full animate-pulse"
                style={{
                  background: `radial-gradient(circle, ${currentCity.theme.primary}40 0%, transparent 70%)`,
                }}
              />
            </div>

            {/* 内容 */}
            <div className="relative z-10 text-center">
              {/* 关闭按钮 */}
              <button
                onClick={handleClose}
                className="absolute top-0 right-0 p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-white/60 hover:text-white/80" />
              </button>

              {/* 成就图标 */}
              <div
                className={`relative w-32 h-32 mx-auto mb-6 rounded-3xl flex items-center justify-center transition-all duration-500 ${phase === "celebrate" ? "animate-bounce" : ""
                  }`}
                style={{
                  background: `linear-gradient(135deg, ${currentCity.theme.primary}50, ${currentCity.theme.secondary}30)`,
                  boxShadow: `0 0 60px ${currentCity.theme.primary}60`,
                }}
              >
                <TierIcon className="w-16 h-16 text-white mb-2" />
                <div className="absolute bottom-2 right-2 text-4xl">{achievement.icon}</div>
              </div>

              {/* 解锁标题 */}
              <h1
                className={`text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r transition-all duration-500 ${phase === "enter" ? "scale-0 opacity-0" : "scale-100 opacity-100"
                  }`}
                style={{
                  backgroundImage: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary}, ${currentCity.theme.primary})`,
                  backgroundSize: "200% auto",
                  animation: phase === "celebrate" ? "shimmer 2s linear infinite" : "none",
                }}
              >
                成就解锁！
              </h1>

              {/* 等级标签 */}
              {phase === "celebrate" && (
                <div
                  className="inline-block px-4 py-2 rounded-xl mb-4 font-bold text-lg"
                  style={{
                    background: `${currentCity.theme.primary}30`,
                    color: currentCity.theme.primary,
                    border: `2px solid ${currentCity.theme.primary}`,
                  }}
                >
                  {tierName}
                </div>
              )}

              {/* 成就名称 */}
              <p
                className={`text-2xl font-bold text-white mb-2 transition-all duration-500 ${phase === "enter" ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
                  }`}
              >
                {achievement.name}
              </p>

              {/* 成就描述 */}
              <p
                className={`text-sm text-white/80 mb-6 transition-all duration-500 delay-100 ${phase === "enter" ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
                  }`}
              >
                {achievement.description}
              </p>

              {/* 奖励 */}
              {phase === "celebrate" && (
                <div
                  className="p-6 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 mb-6 transition-all duration-500"
                >
                  <h3 className="text-sm font-bold text-white mb-4">获得奖励</h3>
                  <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                      <Star className="w-8 h-8 text-yellow-400 mx-auto mb-2 animate-pulse" />
                      <p className="text-3xl font-black text-white">+{achievement.rewards.experience}</p>
                      <p className="text-xs text-white/60">经验值</p>
                    </div>
                    <div className="w-px h-16 bg-white/20" />
                    <div className="text-center">
                      <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-2 animate-pulse" />
                      <p className="text-3xl font-black text-white">+{achievement.rewards.points}</p>
                      <p className="text-xs text-white/60">积分</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 领取按钮 & 分享海报 */}
              {phase === "celebrate" && (
                <div className="flex gap-4">
                  <button
                    onClick={handleGeneratePoster}
                    disabled={isGenerating}
                    className="flex-1 py-4 rounded-2xl font-bold text-white text-base md:text-lg border border-white/20 hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    保存海报
                  </button>
                  <button
                    onClick={handleClaim}
                    className="flex-1 py-4 rounded-2xl font-black text-white text-base md:text-lg transition-all duration-200 hover:scale-105 active:scale-95 animate-pulse"
                    style={{
                      background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})`,
                      boxShadow: `0 10px 40px ${currentCity.theme.primary}40`,
                    }}
                  >
                    前往领取
                  </button>
                </div>
              )}
            </div>

            {/* 底部光效 */}
            <div className="absolute bottom-0 left-0 right-0 h-1">
              <div
                className="h-full transition-all duration-1000"
                style={{
                  width: phase === "celebrate" ? "100%" : "0%",
                  background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * 彩带粒子组件
 */
function ConfettiParticle({
  particle,
  phase,
  currentCity,
}: {
  particle: {
    id: number
    x: number
    y: number
    vx: number
    vy: number
    color: string
    size: number
  }
  phase: "enter" | "celebrate" | "exit"
  currentCity: { theme: { primary: string; secondary: string } }
}) {
  const [position, setPosition] = useState(() => ({ x: particle.x, y: particle.y }))
  const [rotation, setRotation] = useState(0)
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    if (phase !== "celebrate") return

    const interval = setInterval(() => {
      setPosition((prev) => ({
        x: prev.x + particle.vx * 0.5,
        y: prev.y + particle.vy * 0.5,
      }))
      setRotation((prev) => prev + 5)
      setOpacity((prev) => Math.max(0, prev - 0.01))
    }, 16)

    return () => clearInterval(interval)
  }, [phase, particle.vx, particle.vy])

  return (
    <div
      className="absolute transition-all duration-500"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `rotate(${rotation}deg)`,
        opacity,
      }}
    >
      <div
        className="rounded-full"
        style={{
          width: `${particle.size}px`,
          height: `${particle.size}px`,
          backgroundColor: particle.color,
          boxShadow: `0 0 ${particle.size}px ${particle.color}`,
        }}
      />
    </div>
  )
}

/**
 * 成就解锁横幅（小尺寸通知）
 */
export function AchievementUnlockBanner({
  achievement,
  isOpen,
  onClose,
}: {
  achievement: Achievement
  isOpen: boolean
  onClose: () => void
}) {
  const { currentCity } = useCity()

  if (!isOpen || !currentCity) return null

  return (
    <div
      className={`fixed top-20 left-4 right-4 z-[350] p-4 rounded-2xl border backdrop-blur-xl transform transition-all duration-500 ${isOpen ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      style={{
        background: `linear-gradient(135deg, ${currentCity.theme.primary}30 0%, ${currentCity.theme.secondary}20 100%)`,
        borderColor: `${currentCity.theme.primary}50`,
        boxShadow: `0 10px 40px ${currentCity.theme.primary}30`,
      }}
    >
      <div className="flex items-center gap-4">
        <div className="text-4xl">{achievement.icon}</div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white/60 mb-1">成就解锁</p>
          <p className="text-base font-bold text-white">{achievement.name}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
          <X className="w-4 h-4 text-white/60" />
        </button>
      </div>
    </div>
  )
}
