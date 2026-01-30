"use client"

import React, { useEffect, useState } from "react"
import { useCity } from "@/contexts/CityContext"
import { Plane, MapPin, ArrowRight } from "lucide-react"

export interface CityTransitionProps {
  fromCityName: string
  toCityName: string
  isActive: boolean
  onComplete?: () => void
  duration?: number
}

export function CityTransition({
  fromCityName,
  toCityName,
  isActive,
  onComplete,
  duration = 2000,
}: CityTransitionProps) {
  const [phase, setPhase] = useState<"in" | "stay" | "out">("in")
  const [progress, setProgress] = useState(0)
  const { currentCity } = useCity()

  useEffect(() => {
    if (!isActive) {
      setPhase("in")
      setProgress(0)
      return
    }

    // 进入阶段 (0-30%)
    const inTimer = setTimeout(() => {
      setPhase("stay")
    }, duration * 0.3)

    // 保持阶段 (30-70%)
    const stayTimer = setTimeout(() => {
      setPhase("out")
    }, duration * 0.7)

    // 动画进度
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 2
        return next >= 100 ? 100 : next
      })
    }, duration / 50)

    // 完成回调
    const completeTimer = setTimeout(() => {
      onComplete?.()
      setProgress(0)
    }, duration)

    return () => {
      clearTimeout(inTimer)
      clearTimeout(stayTimer)
      clearTimeout(completeTimer)
      clearInterval(progressTimer)
    }
  }, [isActive, duration, onComplete])

  if (!isActive) return null

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-300"
    >
      {/* 飞机模式 - 飞行动画 */}
      {phase !== "out" && (
        <div className="relative flex h-full w-full items-center justify-center">
          {/* 背景地图线条 */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ marginTop: "2px" }} />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ marginTop: "-2px" }} />

            {/* 垂直网格线 */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-px bg-white/5"
                style={{
                  left: `${(i + 1) * 5}%`,
                  animation: `grid-scroll ${duration}ms linear infinite`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>

          {/* 起点城市 */}
          {phase === "in" && (
            <div className="absolute left-[20%] flex flex-col items-center animate-in slide-in-from-left-8 fade-in duration-500">
              <div
                className="mb-2 rounded-full p-3"
                style={{
                  backgroundColor: `${currentCity?.themeColors.primary}40`,
                  border: `2px solid ${currentCity?.themeColors.primary}`,
                }}
              >
                <MapPin className="h-8 w-8 text-white" />
              </div>
              <p className="text-lg font-bold text-white">{fromCityName}</p>
              <p className="text-sm text-white/60">出发地</p>
            </div>
          )}

          {/* 终点城市 */}
          {phase === "stay" || phase === "in" ? (
            <div
              className={`absolute right-[20%] flex flex-col items-center ${
                phase === "stay" ? "animate-in zoom-in-95 fade-in duration-500" : "opacity-0"
              }`}
            >
              <div
                className="mb-2 rounded-full p-3"
                style={{
                  backgroundColor: `${currentCity?.themeColors.secondary}40`,
                  border: `2px solid ${currentCity?.themeColors.secondary}`,
                }}
              >
                <MapPin className="h-8 w-8 text-white" />
              </div>
              <p className="text-lg font-bold text-white">{toCityName}</p>
              <p className="text-sm text-white/60">目的地</p>
            </div>
          ) : null}

          {/* 飞机 */}
          {phase === "in" || phase === "stay" ? (
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: phase === "in" ? "20%" : "50%",
                transition: "left 800ms ease-out",
              }}
            >
              {/* 轨迹线 */}
              {phase === "in" && (
                <div
                  className="absolute h-0.5 bg-gradient-to-r from-white/60 to-transparent"
                  style={{
                    width: "30%",
                    left: 0,
                  }}
                />
              )}

              {/* 飞机本体 */}
              <div
                className="relative flex items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 p-4 shadow-2xl"
                style={{
                  transform: phase === "in" ? "rotate(-45deg)" : "rotate(0deg)",
                  transition: "transform 800ms ease-out",
                  boxShadow: `0 0 30px ${currentCity?.themeColors.primary}80`,
                }}
              >
                <Plane className="h-12 w-12 text-white" />

                {/* 尾迹 */}
                <div
                  className="absolute -right-20 top-1/2 h-2 w-16 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-500/60 to-transparent"
                  style={{
                    animation: "trail 800ms ease-out",
                  }}
                />
              </div>

              {/* 箭头指示 */}
              {phase === "in" && (
                <div className="ml-8 animate-pulse">
                  <ArrowRight className="h-8 w-8 text-white/80" />
                </div>
              )}
            </div>
          ) : null}

          {/* 中心文本 */}
          {phase === "stay" && (
            <div className="absolute inset-0 flex items-center justify-center animate-in zoom-in-95 fade-in duration-500">
              <div className="rounded-3xl bg-black/60 backdrop-blur-md border border-white/10 p-8">
                <p className="text-2xl font-bold text-white">正在前往</p>
                <p
                  className="mt-2 text-3xl font-bold"
                  style={{
                    color: currentCity?.themeColors.primary,
                  }}
                >
                  {toCityName}
                </p>
                <p className="mt-4 text-sm text-white/60">飞行中...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 地图快速掠过模式
export interface MapSweepTransitionProps {
  fromCity: { name: string; color: string }
  toCity: { name: string; color: string }
  isActive: boolean
  onComplete?: () => void
  duration?: number
}

export function MapSweepTransition({
  fromCity,
  toCity,
  isActive,
  onComplete,
  duration = 2500,
}: MapSweepTransitionProps) {
  const [phase, setPhase] = useState<"enter" | "sweep" | "exit">("enter")
  const [sweepProgress, setSweepProgress] = useState(0)

  useEffect(() => {
    if (!isActive) {
      setPhase("enter")
      setSweepProgress(0)
      return
    }

    // 进入阶段
    const enterTimer = setTimeout(() => {
      setPhase("sweep")
    }, duration * 0.15)

    // 扫掠阶段
    const sweepTimer = setTimeout(() => {
      setPhase("exit")
    }, duration * 0.85)

    // 扫掠进度
    const progressTimer = setInterval(() => {
      setSweepProgress((prev) => {
        const next = prev + 2
        return next >= 100 ? 100 : next
      })
    }, (duration * 0.7) / 50)

    // 完成
    const completeTimer = setTimeout(() => {
      onComplete?.()
      setSweepProgress(0)
    }, duration)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(sweepTimer)
      clearTimeout(completeTimer)
      clearInterval(progressTimer)
    }
  }, [isActive, duration, onComplete])

  if (!isActive) return null

  return (
    <div className="fixed inset-0 z-[600] overflow-hidden">
      {/* 黑色遮罩 */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          phase === "enter" ? "opacity-100" : phase === "exit" ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* 扫掠层 */}
      {phase === "sweep" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
          {/* 扫掠线条 */}
          <div
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent"
            style={{
              top: `${sweepProgress}%`,
              boxShadow: "0 0 20px rgba(255,255,255,0.8), 0 0 40px rgba(255,255,255,0.4)",
            }}
          />

          {/* 城市名称切换 */}
          <div className="relative z-10 text-center">
            {sweepProgress < 50 ? (
              <div
                className="animate-out fade-out zoom-out-95 duration-300"
                style={{
                  color: fromCity.color,
                }}
              >
                <p className="text-3xl font-bold">{fromCity.name}</p>
                <p className="mt-2 text-sm text-white/60">离开</p>
              </div>
            ) : (
              <div
                className="animate-in fade-in zoom-in-95 duration-300"
                style={{
                  color: toCity.color,
                }}
              >
                <p className="text-3xl font-bold">{toCity.name}</p>
                <p className="mt-2 text-sm text-white/60">到达</p>
              </div>
            )}
          </div>

          {/* 装饰性粒子 */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="absolute h-1 w-1 rounded-full bg-white/30"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animation: `particle-float ${2000 + Math.random() * 2000}ms linear infinite`,
                  animationDelay: `${Math.random() * 2000}ms`,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
