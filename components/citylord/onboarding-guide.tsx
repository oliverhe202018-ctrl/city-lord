"use client"

import React from "react"

import { useState, useEffect } from "react"
import { X, ChevronRight, Footprints, Target, Trophy, Sparkles, MapPin, Layers, Shield } from "lucide-react"

interface OnboardingStep {
  id: number
  title: string
  description: string
  targetArea: "start-button" | "daily-goal" | "missions" | "leaderboard" | "territory-hp"
  icon: React.ElementType
  position: "center" | "top" | "bottom"
}

const steps: OnboardingStep[] = [
  {
    id: 1,
    title: "欢迎来到 City Lord",
    description: "点击下方的「开始跑步」按钮，出发占领你的第一块领地！",
    targetArea: "start-button",
    icon: Footprints,
    position: "bottom",
  },
  {
    id: 2,
    title: "闭环占领",
    description: "跑出一个闭环路线，当你回到起点 20米内 时，路径围成的区域将自动吸附成为你的领地！",
    targetArea: "daily-goal",
    icon: MapPin,
    position: "top",
  },
  {
    id: 3,
    title: "你的江山",
    description: "金色区域是你已打下的江山。点击右侧「图层」按钮可以隐藏它，让跑步视野更清爽。",
    targetArea: "missions",
    icon: Layers,
    position: "center",
  },
  {
    id: 4,
    title: "争霸天下",
    description: "点击排行榜查看其他跑者，点击头像可访问TA的主页！",
    targetArea: "leaderboard",
    icon: Trophy,
    position: "center",
  },
  {
    id: 5,
    title: "领地攻防",
    description: "经过他人领地时会扣除其生命值！当 HP 归零后可以占领。频繁易主的区域会成为🔥热门区域，积分翻倍！",
    targetArea: "territory-hp",
    icon: Shield,
    position: "center",
  },
]

interface OnboardingGuideProps {
  onComplete: () => void
  isVisible: boolean
}

export function OnboardingGuide({ onComplete, isVisible }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true)
    }
  }, [isVisible])

  if (!isVisible) return null

  const step = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const Icon = step.icon

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  // Position styles based on target area
  const getPositionStyles = () => {
    switch (step.targetArea) {
      case "start-button":
        return "bottom-44"
      case "daily-goal":
        return "top-48"
      case "missions":
      case "leaderboard":
        return "top-1/2 -translate-y-1/2"
      default:
        return "top-1/2 -translate-y-1/2"
    }
  }

  // Spotlight position
  const getSpotlightStyles = () => {
    switch (step.targetArea) {
      case "start-button":
        return "bottom-28 left-1/2 -translate-x-1/2 h-28 w-28 rounded-full"
      case "daily-goal":
        return "top-20 left-4 right-4 h-32 rounded-2xl"
      case "missions":
        return "bottom-20 left-4 w-24 h-16 rounded-2xl"
      case "leaderboard":
        return "bottom-20 left-1/2 -translate-x-1/2 w-16 h-16 rounded-2xl"
      default:
        return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full"
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay */}
      <div
        className={`absolute inset-0 bg-black/80 transition-opacity duration-500 ${isAnimating ? "opacity-100" : "opacity-0"
          }`}
      />

      {/* Spotlight effect */}
      <div
        className={`absolute ${getSpotlightStyles()} pointer-events-none transition-all duration-500`}
        style={{
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.8), 0 0 40px 10px rgba(34,197,94,0.4)",
        }}
      />

      {/* Pulsing ring around spotlight */}
      <div
        className={`absolute ${getSpotlightStyles()} pointer-events-none animate-ping opacity-30`}
        style={{
          boxShadow: "0 0 0 4px rgba(34,197,94,0.6)",
          animationDuration: "2s",
        }}
      />

      {/* Guide card */}
      <div
        className={`absolute left-4 right-4 ${getPositionStyles()} z-10 transition-all duration-500 ${isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
      >
        <div className="rounded-2xl border border-[#22c55e]/30 bg-[#0f172a]/95 p-4 shadow-[0_0_30px_rgba(34,197,94,0.2)] backdrop-blur-xl">
          {/* Step indicator */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22c55e]/20">
                <Icon className="h-4 w-4 text-[#22c55e]" />
              </div>
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full transition-colors ${i <= currentStep ? "bg-[#22c55e]" : "bg-white/20"
                      }`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={handleSkip}
              className="rounded-full p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="mb-4">
            <h3 className="mb-1 text-lg font-bold text-white">{step.title}</h3>
            <p className="text-sm leading-relaxed text-white/70">{step.description}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              跳过引导
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-medium text-black transition-all hover:bg-[#22c55e]/90 active:scale-[0.98]"
            >
              {isLastStep ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始探索
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Arrow pointing to target */}
        {step.targetArea === "start-button" && (
          <div className="flex justify-center">
            <div className="h-8 w-px bg-gradient-to-b from-[#22c55e] to-transparent" />
          </div>
        )}
        {step.targetArea === "daily-goal" && (
          <div className="absolute -top-8 left-1/2 flex -translate-x-1/2 rotate-180 justify-center">
            <div className="h-8 w-px bg-gradient-to-b from-[#22c55e] to-transparent" />
          </div>
        )}
      </div>
    </div>
  )
}
