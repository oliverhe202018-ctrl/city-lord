"use client"

import React, { useEffect, useState } from "react"
import { CheckCircle2, Sparkles, Trophy } from "lucide-react"
import { useCity } from "@/contexts/CityContext"

export interface TaskCompletionAnimationProps {
  isActive: boolean
  taskTitle: string
  rewardPoints: number
  rewardExperience: number
  onComplete: () => void
  duration?: number
}

export function TaskCompletionAnimation({
  isActive,
  taskTitle,
  rewardPoints,
  rewardExperience,
  onComplete,
  duration = 2000,
}: TaskCompletionAnimationProps) {
  const { currentCity } = useCity()
  const [showParticles, setShowParticles] = useState(false)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    if (isActive) {
      setShowParticles(true)
      setTimeout(() => setShowContent(true), 200)

      const timer = setTimeout(() => {
        onComplete()
      }, duration)

      return () => clearTimeout(timer)
    } else {
      setShowParticles(false)
      setShowContent(false)
    }
  }, [isActive, duration, onComplete])

  if (!isActive) return null

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      {/* 粒子效果 */}
      {showParticles && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, index) => {
            const angle = (index / 30) * 2 * Math.PI
            const distance = 150 + Math.random() * 100
            const x = Math.cos(angle) * distance
            const y = Math.sin(angle) * distance
            const delay = index * 0.03
            const color = index % 3 === 0 ? "#22c55e" : index % 3 === 1 ? "#3b82f6" : "#f59e0b"

            return (
              <div
                key={index}
                className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full animate-in fade-in zoom-in"
                style={{
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                  backgroundColor: color,
                  animationDelay: `${delay}s`,
                  animationDuration: "0.6s",
                  boxShadow: `0 0 10px ${color}`,
                }}
              />
            )
          })}
        </div>
      )}

      {/* 主要内容 */}
      {showContent && (
        <div className="relative z-10 animate-in zoom-in-95 duration-300">
          {/* 背景光晕 */}
          <div
            className="absolute inset-0 -m-20 rounded-full blur-3xl opacity-50"
            style={{
              background: `radial-gradient(circle, ${currentCity?.themeColors.primary}40, transparent)`,
            }}
          />

          {/* 动画容器 */}
          <div className="relative flex flex-col items-center gap-6 p-12">
            {/* 完成图标 */}
            <div className="relative">
              {/* 脉冲环 */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite",
                  backgroundColor: `${currentCity?.themeColors.primary}40`,
                }}
              />

              {/* 主图标 */}
              <div
                className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-2xl"
                style={{
                  boxShadow: `0 0 40px ${currentCity?.themeColors.primary}60`,
                }}
              >
                <CheckCircle2 className="h-12 w-12 text-white" />
              </div>

              {/* 火花装饰 */}
              <div className="absolute -top-2 -right-2">
                <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" />
              </div>
            </div>

            {/* 文本 */}
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-2">任务完成！</h2>
              <p className="text-lg text-white/80">{taskTitle}</p>
            </div>

            {/* 奖励 */}
            <div className="flex gap-4">
              <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <div>
                  <p className="text-[10px] text-white/50">积分</p>
                  <p className="text-lg font-bold text-white">+{rewardPoints}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-[10px] text-white/50">经验</p>
                  <p className="text-lg font-bold text-white">+{rewardExperience}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
