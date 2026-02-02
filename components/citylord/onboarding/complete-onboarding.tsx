"use client"

import { useState, useEffect, useMemo } from "react"
import { 
  X, 
  ChevronRight, 
  ChevronLeft,
  MapPin, 
  Target, 
  Trophy, 
  Users,
  Hexagon,
  Zap,
  Play,
  Check,
  Sparkles
} from "lucide-react"

// ============================================================
// 1. Welcome Screen - First Login
// ============================================================

interface WelcomeScreenProps {
  isOpen: boolean
  onComplete: () => void
  userName?: string
}

export function WelcomeScreen({ isOpen, onComplete, userName = "跑者" }: WelcomeScreenProps) {
  const [step, setStep] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setStep(0)
      setIsAnimating(true)
    }
  }, [isOpen])

  if (!isOpen) return null

  const welcomeSteps = [
    {
      title: "欢迎来到 CityLord",
      subtitle: "用脚步征服你的城市",
      description: "在这里，每一次跑步都是一场领地争夺战。准备好开始你的征程了吗？",
      icon: "🏃",
      color: "#22c55e",
    },
    {
      title: "跑步占领领地",
      subtitle: "你的脚步就是你的武器",
      description: "当你跑过一个区域时，该区域的六边形领地就会被你占领。跑得越多，领地越大！",
      icon: "🗺️",
      color: "#06b6d4",
    },
    {
      title: "守护与争夺",
      subtitle: "保卫你的地盘",
      description: "其他玩家可以抢占你的领地，你也可以通过再次跑过来夺回。这是一场永不停止的战斗！",
      icon: "⚔️",
      color: "#f59e0b",
    },
    {
      title: "准备好了吗？",
      subtitle: `${userName}，开启你的征程`,
      description: "完成每日任务、挑战好友、攀登排行榜。成为这座城市真正的主人！",
      icon: "🏆",
      color: "#8b5cf6",
    },
  ]

  const currentStep = welcomeSteps[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div 
          className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30"
          style={{
            background: `radial-gradient(circle, ${currentStep.color}40 0%, transparent 70%)`,
            animation: 'pulse 3s ease-in-out infinite',
          }}
        />
      </div>

      <div className="relative mx-4 w-full max-w-md">
        {/* Skip button */}
        <button
          onClick={onComplete}
          className="absolute -top-12 right-0 flex items-center gap-1 text-sm text-white/50 hover:text-white"
        >
          跳过
          <X className="h-4 w-4" />
        </button>

        {/* Content Card */}
        <div 
          className={`rounded-3xl border border-white/10 bg-[#0f172a]/95 p-8 backdrop-blur-xl transition-all duration-500 ${
            isAnimating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Icon */}
          <div 
            className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full text-5xl"
            style={{ backgroundColor: `${currentStep.color}20` }}
          >
            {currentStep.icon}
          </div>

          {/* Text */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-2xl font-bold text-white">{currentStep.title}</h1>
            <p className="mb-4 text-lg" style={{ color: currentStep.color }}>{currentStep.subtitle}</p>
            <p className="text-sm text-white/60">{currentStep.description}</p>
          </div>

          {/* Progress Dots */}
          <div className="mb-6 flex justify-center gap-2">
            {welcomeSteps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step ? "w-6" : "w-2"
                }`}
                style={{ 
                  backgroundColor: i === step ? currentStep.color : "rgba(255,255,255,0.2)" 
                }}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center justify-center rounded-xl bg-white/10 px-4 py-3 text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => {
                if (step < welcomeSteps.length - 1) {
                  setStep(step + 1)
                } else {
                  onComplete()
                }
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold text-black transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: currentStep.color }}
            >
              {step < welcomeSteps.length - 1 ? (
                <>
                  继续
                  <ChevronRight className="h-5 w-5" />
                </>
              ) : (
                <>
                  开始冒险
                  <Sparkles className="h-5 w-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 2. Interactive Tutorial - Step by Step Guide
// ============================================================

interface TutorialStep {
  id: string
  target: string // CSS selector or element ID
  title: string
  description: string
  position: "top" | "bottom" | "left" | "right" | "center"
  action?: string
  highlightArea?: { x: number; y: number; width: number; height: number }
}

interface InteractiveTutorialProps {
  isOpen: boolean
  onComplete: () => void
  currentStep: number
  onStepChange: (step: number) => void
}

export function InteractiveTutorial({
  isOpen,
  onComplete,
  currentStep,
  onStepChange
}: InteractiveTutorialProps) {
  const [highlightPosition, setHighlightPosition] = useState({ x: 0, y: 0, width: 0, height: 0 })

  // Memoize tutorial steps to avoid recreating the array on every render
  const tutorialSteps = useMemo<TutorialStep[]>(() => [
    {
      id: "start-run",
      target: "#start-run-button",
      title: "开始你的第一次跑步",
      description: "点击这个按钮开始跑步。当你移动时，你经过的六边形区域将被你占领！",
      position: "top",
      action: "点击「开始跑步」按钮",
    },
    {
      id: "hex-grid",
      target: "#hex-grid",
      title: "六边形地图",
      description: "绿色是你的领地，红色是敌人的领地。灰色区域等待你去探索和占领！",
      position: "center",
      action: "了解地图标记",
    },
    {
      id: "daily-goal",
      target: "#daily-goal",
      title: "每日目标",
      description: "完成每日目标可以获得双倍经验！今天的目标是占领5个领地或跑步3公里。",
      position: "bottom",
      action: "查看今日目标",
    },
    {
      id: "missions",
      target: "#nav-missions",
      title: "任务系统",
      description: "完成各种任务获取丰厚奖励。有每日任务、每周任务和成就挑战！",
      position: "top",
      action: "点击「任务」标签",
    },
    {
      id: "leaderboard",
      target: "#nav-leaderboard",
      title: "排行榜",
      description: "与全城跑者一较高下！查看谁占领了最多的领地。",
      position: "top",
      action: "点击「排行榜」标签",
    },
    {
      id: "friends",
      target: "#nav-social",
      title: "好友系统",
      description: "添加好友，发起挑战，查看好友动态。跑步不再孤单！",
      position: "top",
      action: "点击「好友」标签",
    },
  ], [])

  const step = tutorialSteps[currentStep]
  const totalSteps = tutorialSteps.length
  const progress = ((currentStep + 1) / totalSteps) * 100

  useEffect(() => {
    if (!isOpen || !step) return

    // Find target element and get its position
    const targetEl = document.querySelector(step.target)
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect()
      setHighlightPosition({
        x: rect.left - 8,
        y: rect.top - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      })
    }
  }, [isOpen, currentStep]) // Remove `step` from deps, only track currentStep index

  if (!isOpen || !step) return null

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      onStepChange(currentStep + 1)
    } else {
      onComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      onStepChange(currentStep - 1)
    }
  }

  // Position tooltip based on step position
  const getTooltipPosition = () => {
    switch (step.position) {
      case "top":
        return {
          bottom: `calc(100% - ${highlightPosition.y - 16}px)`,
          left: highlightPosition.x + highlightPosition.width / 2,
          transform: "translateX(-50%)",
        }
      case "bottom":
        return {
          top: highlightPosition.y + highlightPosition.height + 16,
          left: highlightPosition.x + highlightPosition.width / 2,
          transform: "translateX(-50%)",
        }
      case "center":
      default:
        return {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay with spotlight cutout */}
      <div className="absolute inset-0 bg-black/80">
        <svg className="h-full w-full">
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={highlightPosition.x}
                y={highlightPosition.y}
                width={highlightPosition.width}
                height={highlightPosition.height}
                rx="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.8)" mask="url(#spotlight-mask)" />
        </svg>
      </div>

      {/* Highlight border */}
      <div
        className="absolute rounded-xl border-2 border-[#22c55e] shadow-[0_0_20px_rgba(34,197,94,0.5)]"
        style={{
          left: highlightPosition.x,
          top: highlightPosition.y,
          width: highlightPosition.width,
          height: highlightPosition.height,
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />

      {/* Tooltip */}
      <div
        className="absolute z-10 w-80 rounded-2xl border border-white/10 bg-[#0f172a] p-4 shadow-2xl"
        style={getTooltipPosition()}
      >
        {/* Progress bar */}
        <div className="mb-3 h-1 rounded-full bg-white/10">
          <div 
            className="h-full rounded-full bg-[#22c55e] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Step counter */}
        <p className="mb-2 text-xs text-white/40">步骤 {currentStep + 1} / {totalSteps}</p>

        {/* Content */}
        <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
        <p className="mb-4 text-sm text-white/60">{step.description}</p>

        {/* Action hint */}
        {step.action && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-[#22c55e]/10 px-3 py-2 text-sm text-[#22c55e]">
            <Play className="h-4 w-4" />
            {step.action}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-2">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
            >
              上一步
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#22c55e] py-2 text-sm font-semibold text-black hover:bg-[#22c55e]/90"
          >
            {currentStep < totalSteps - 1 ? (
              <>
                下一步
                <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              <>
                完成教程
                <Check className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Skip */}
        <button
          onClick={onComplete}
          className="mt-3 w-full text-center text-xs text-white/40 hover:text-white/60"
        >
          跳过教程
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 3. Quick Navigation Popup
// ============================================================

interface QuickNavPopupProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (tab: string) => void
  missionCount?: number
}

export function QuickNavPopup({ isOpen, onClose, onNavigate, missionCount }: QuickNavPopupProps) {
  if (!isOpen) return null

  const navOptions = [
    {
      id: "missions",
      title: "查看任务",
      description: "完成任务获取奖励",
      icon: Target,
      color: "#22c55e",
      badge: missionCount !== undefined && missionCount > 0 ? `${missionCount}个可领取` : undefined,
    },
    {
      id: "leaderboard",
      title: "排行榜",
      description: "看看你的排名",
      icon: Trophy,
      color: "#f59e0b",
      badge: "第42名",
    },
    {
      id: "social",
      title: "好友",
      description: "与好友互动",
      icon: Users,
      color: "#8b5cf6",
      badge: "5人在线",
    },
  ]

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md animate-slide-up rounded-t-3xl border-t border-white/10 bg-[#0f172a] p-6"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'slideUp 0.3s ease-out',
        }}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />

        <h2 className="mb-4 text-center text-lg font-bold text-white">快速导航</h2>

        <div className="space-y-3">
          {navOptions.map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                onClick={() => {
                  onNavigate(option.id)
                  onClose()
                }}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10 active:scale-[0.98]"
              >
                <div 
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${option.color}20` }}
                >
                  <Icon className="h-6 w-6" style={{ color: option.color }} />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-white">{option.title}</p>
                  <p className="text-xs text-white/50">{option.description}</p>
                </div>
                {option.badge && (
                  <span 
                    className="rounded-full px-2 py-1 text-xs font-medium"
                    style={{ 
                      backgroundColor: `${option.color}20`,
                      color: option.color 
                    }}
                  >
                    {option.badge}
                  </span>
                )}
                <ChevronRight className="h-5 w-5 text-white/30" />
              </button>
            )
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl bg-white/10 py-3 text-sm font-medium text-white/60 hover:bg-white/20"
        >
          关闭
        </button>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ============================================================
// 4. Hex Map Interaction Guide
// ============================================================

interface MapInteractionGuideProps {
  isOpen: boolean
  onClose: () => void
}

export function MapInteractionGuide({ isOpen, onClose }: MapInteractionGuideProps) {
  const [activeDemo, setActiveDemo] = useState<"tap" | "swipe" | "zoom" | null>(null)

  if (!isOpen) return null

  const interactions = [
    {
      id: "tap" as const,
      title: "点击查看",
      description: "点击任意六边形查看详情",
      icon: "👆",
      demo: "点击中央的六边形试试",
    },
    {
      id: "swipe" as const,
      title: "滑动浏览",
      description: "滑动地图探索更多区域",
      icon: "👋",
      demo: "左右滑动地图",
    },
    {
      id: "zoom" as const,
      title: "双指缩放",
      description: "双指捏合缩放地图大小",
      icon: "🤏",
      demo: "双指放大缩小",
    },
  ]

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="mx-4 w-full max-w-md rounded-3xl border border-white/10 bg-[#0f172a] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#22c55e]/20">
            <Hexagon className="h-8 w-8 text-[#22c55e]" />
          </div>
          <h2 className="text-xl font-bold text-white">地图操作指南</h2>
          <p className="mt-1 text-sm text-white/50">学习如何与六边形地图互动</p>
        </div>

        {/* Demo Area */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-black/40 p-8">
          <div className="relative mx-auto h-32 w-32">
            {/* Hex grid demo */}
            <svg viewBox="0 0 100 100" className="h-full w-full">
              <polygon 
                points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" 
                fill={activeDemo ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.1)"}
                stroke={activeDemo ? "#22c55e" : "rgba(255,255,255,0.3)"}
                strokeWidth="2"
                className="transition-all duration-300"
              />
            </svg>
            {activeDemo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="animate-bounce text-2xl">
                  {interactions.find(i => i.id === activeDemo)?.icon}
                </span>
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-sm text-white/50">
            {activeDemo 
              ? interactions.find(i => i.id === activeDemo)?.demo 
              : "选择下方操作查看演示"
            }
          </p>
        </div>

        {/* Interaction List */}
        <div className="space-y-2">
          {interactions.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveDemo(activeDemo === item.id ? null : item.id)}
              className={`flex w-full items-center gap-3 rounded-xl p-3 transition-all ${
                activeDemo === item.id
                  ? "bg-[#22c55e]/20 border border-[#22c55e]/50"
                  : "bg-white/5 border border-transparent hover:bg-white/10"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1 text-left">
                <p className="font-medium text-white">{item.title}</p>
                <p className="text-xs text-white/50">{item.description}</p>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] py-3 font-semibold text-black hover:bg-[#22c55e]/90"
        >
          <Check className="h-5 w-5" />
          我知道了
        </button>
      </div>
    </div>
  )
}
