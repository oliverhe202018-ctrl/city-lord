"use client"

import React, { useState, useEffect } from "react"
import {
    Heart,
    Flame,
    Trophy,
    ChevronRight,
    X,
    Sparkles,
    Shield,
    Swords,
    TrendingUp,
} from "lucide-react"

// ============================================================
// TerritoryTutorial — 3-Step Interactive Tutorial
//
// Educates users about:
//   Step 1: Territory HP (生命值)
//   Step 2: Hot Zones (热门区域)
//   Step 3: Score Attack & Defense (积分攻防)
//
// Automatically shown on first visit to territory features.
// Persists completion state in localStorage.
// ============================================================

const STORAGE_KEY = "territory_tutorial_completed"

interface TerritoryTutorialProps {
    /** Called when tutorial is completed or skipped */
    onComplete: () => void
    /** Force visibility override */
    forceShow?: boolean
}

interface TutorialStep {
    id: number
    title: string
    description: string
    icon: React.ElementType
    color: string
    bgColor: string
    illustration: React.ReactNode
}

export function TerritoryTutorial({
    onComplete,
    forceShow = false,
}: TerritoryTutorialProps) {
    const [currentStep, setCurrentStep] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    useEffect(() => {
        if (forceShow) {
            setIsVisible(true)
            setIsAnimating(true)
            return
        }

        // Check localStorage
        try {
            const completed = localStorage.getItem(STORAGE_KEY)
            if (!completed) {
                setIsVisible(true)
                setIsAnimating(true)
            }
        } catch {
            // localStorage unavailable
        }
    }, [forceShow])

    const handleComplete = () => {
        try {
            localStorage.setItem(STORAGE_KEY, "true")
        } catch {
            // ignore
        }
        setIsAnimating(false)
        setTimeout(() => {
            setIsVisible(false)
            onComplete()
        }, 300)
    }

    const handleNext = () => {
        if (currentStep === steps.length - 1) {
            handleComplete()
        } else {
            setCurrentStep((prev) => prev + 1)
        }
    }

    if (!isVisible) return null

    const steps: TutorialStep[] = [
        {
            id: 1,
            title: "领地生命值",
            description:
                "每块领地拥有 1000 点生命值。当其他跑者经过你的领地时，会扣除一定的 HP。当 HP 归零时，领地将变为无主状态，可以被他人占领。",
            icon: Heart,
            color: "text-emerald-400",
            bgColor: "bg-emerald-500/20",
            illustration: <HPIllustration />,
        },
        {
            id: 2,
            title: "热门区域",
            description:
                "7 天内被多次易主的区域会标记为热门区域 🔥。热门区域积分 ×0.5（争夺激烈惩罚），失去时扣除原积分的 50%，攻防博弈更具策略性！",
            icon: Flame,
            color: "text-orange-400",
            bgColor: "bg-orange-500/20",
            illustration: <HotZoneIllustration />,
        },
        {
            id: 3,
            title: "积分攻防",
            description:
                "占领领地获得面积积分（1000分/km²）。热门区域积分 ×0.5，普通区域 ×1.0。失去领地扣除 50% 积分。积分仅用于攻击和占领领地时的收益，排行榜排名仅基于控制区域的数量。",
            icon: Trophy,
            color: "text-purple-400",
            bgColor: "bg-purple-500/20",
            illustration: <ScoreIllustration />,
        },
    ]

    const step = steps[currentStep]
    const isLastStep = currentStep === steps.length - 1
    const Icon = step.icon

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300 ${isAnimating ? "opacity-100" : "opacity-0"
                    }`}
                onClick={handleComplete}
            />

            {/* Card */}
            <div
                className={`relative w-full max-w-sm transform overflow-hidden rounded-3xl border border-white/10 bg-[#0f172a]/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ${isAnimating
                    ? "scale-100 opacity-100"
                    : "scale-95 opacity-0"
                    }`}
            >
                {/* Close */}
                <button
                    onClick={handleComplete}
                    className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white"
                >
                    <X className="h-4 w-4" />
                </button>

                {/* Step indicator */}
                <div className="flex justify-center gap-2 px-6 pt-6">
                    {steps.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 w-8 rounded-full transition-colors duration-300 ${i <= currentStep ? "bg-white/60" : "bg-white/15"
                                }`}
                        />
                    ))}
                </div>

                {/* Illustration area */}
                <div className="flex justify-center px-6 pt-6">
                    <div
                        className={`flex h-24 w-24 items-center justify-center rounded-full ${step.bgColor}`}
                    >
                        <Icon className={`h-12 w-12 ${step.color}`} />
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 pt-4">
                    <h2 className="text-center text-xl font-bold text-white">
                        {step.title}
                    </h2>

                    {/* Mini illustration */}
                    <div className="my-4">{step.illustration}</div>

                    <p className="text-center text-sm leading-relaxed text-white/60">
                        {step.description}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-white/10 p-4">
                    <button
                        onClick={handleComplete}
                        className="text-sm text-white/40 hover:text-white transition-colors"
                    >
                        跳过教程
                    </button>
                    <button
                        onClick={handleNext}
                        className="flex items-center gap-1.5 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95"
                    >
                        {isLastStep ? (
                            <>
                                <Sparkles className="h-4 w-4" />
                                开始征战
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
        </div>
    )
}

// ── Mini Illustrations ──

function HPIllustration() {
    return (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/5 p-3">
            <Shield className="h-5 w-5 text-emerald-400" />
            <div className="flex-1">
                <div className="mb-1 flex justify-between text-[10px] text-white/40">
                    <span>生命值</span>
                    <span>850/1000</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[85%] rounded-full bg-gradient-to-r from-emerald-400 to-green-500" />
                </div>
            </div>
            <Swords className="h-4 w-4 text-red-400 animate-pulse" />
        </div>
    )
}

function HotZoneIllustration() {
    return (
        <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/5 p-3">
            <div className="flex items-center gap-1.5 rounded-full bg-orange-500/20 px-2 py-1">
                <Flame className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-[10px] font-medium text-orange-300">热门</span>
            </div>
            <div className="text-xs text-white/40">→</div>
            <div className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-1">
                <TrendingUp className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-[10px] font-bold text-yellow-300">×0.5</span>
            </div>
        </div>
    )
}

function ScoreIllustration() {
    return (
        <div className="flex items-center justify-center gap-4 rounded-2xl bg-white/5 p-3">
            <div className="text-center">
                <div className="text-sm font-bold text-yellow-400">+500</div>
                <div className="text-[10px] text-white/40">热门区得分</div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-center">
                <div className="text-sm font-bold text-emerald-400">+1000</div>
                <div className="text-[10px] text-white/40">普通区得分</div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-center">
                <div className="text-sm font-bold text-red-400">-500</div>
                <div className="text-[10px] text-white/40">失去扣分</div>
            </div>
        </div>
    )
}
