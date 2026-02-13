"use client"

import { useState, useEffect } from "react"
import { X, Swords, Trophy, Clock, Zap, User, MapPin, ChevronRight, Sparkles } from "lucide-react"

interface ChallengeInviteProps {
  isOpen: boolean
  onClose: () => void
  challenger: {
    name: string
    avatar?: string
    level: number
    wins: number
    clan?: string
  }
  challenge: {
    type: "race" | "capture" | "distance"
    title: string
    description: string
    duration: string
    reward: number
    location?: string
  }
  onAccept?: () => void
  onDecline?: () => void
}

const challengeTypeConfig = {
  race: { icon: Zap, color: "text-cyan-500", bg: "bg-cyan-500/20", label: "竞速挑战" },
  capture: { icon: MapPin, color: "text-purple-500", bg: "bg-purple-500/20", label: "占领挑战" },
  distance: { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/20", label: "里程挑战" },
}

export function ChallengeInvite({
  isOpen,
  onClose,
  challenger,
  challenge,
  onAccept,
  onDecline,
}: ChallengeInviteProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      setIsExiting(false)
      setCountdown(30)
    }
  }, [isOpen])

  // Auto-decline countdown
  useEffect(() => {
    if (!isOpen || countdown <= 0) return
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleDecline()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [isOpen, countdown])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(() => {
      setIsAnimating(false)
      onClose()
    }, 300)
  }

  const handleAccept = () => {
    onAccept?.()
    handleClose()
  }

  const handleDecline = () => {
    onDecline?.()
    handleClose()
  }

  if (!isOpen && !isAnimating) return null

  const typeConfig = challengeTypeConfig[challenge.type]
  const TypeIcon = typeConfig.icon

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleDecline}
      />

      {/* Card - slides up on mobile */}
      <div
        className={`relative w-full max-w-sm transform overflow-hidden rounded-3xl border border-green-500/30 bg-gradient-to-b from-green-500/10 to-card shadow-2xl shadow-green-500/10 backdrop-blur-xl transition-all duration-300 ${
          isExiting
            ? "scale-95 opacity-0 translate-y-8"
            : "scale-100 opacity-100 translate-y-0"
        }`}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -inset-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-muted/10 to-transparent" />
        </div>

        {/* Countdown ring */}
        <div className="absolute right-4 top-4 z-10">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <svg className="absolute h-full w-full -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                className="text-muted-foreground/20"
                strokeWidth="3"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="#22c55e"
                strokeWidth="3"
                strokeDasharray={100}
                strokeDashoffset={100 - (countdown / 30) * 100}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className="text-xs font-bold text-green-500">{countdown}</span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleDecline}
          className="absolute left-4 top-4 z-10 rounded-full bg-muted p-2 text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with challenger */}
        <div className="relative px-6 pt-8">
          <div className="flex flex-col items-center">
            {/* Challenger avatar with glow */}
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-green-500/30 blur-xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-green-500/50 bg-gradient-to-br from-green-500/30 to-green-500/10">
                {challenger.avatar ? (
                  <span className="text-3xl">{challenger.avatar}</span>
                ) : (
                  <User className="h-10 w-10 text-green-500" />
                )}
              </div>
              {/* Challenge badge */}
              <div className={`absolute -bottom-1 -right-1 rounded-full ${typeConfig.bg} p-1.5`}>
                <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
              </div>
            </div>

            {/* Challenger info */}
            <div className="mt-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg font-bold text-foreground">{challenger.name}</span>
                {challenger.clan && (
                  <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs font-medium text-green-500">
                    [{challenger.clan}]
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                等级 {challenger.level} | {challenger.wins} 胜
              </p>
            </div>

            <div className="mt-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeConfig.bg} ${typeConfig.color}`}>
                {typeConfig.label}
              </span>
            </div>
          </div>
        </div>

        {/* Challenge details */}
        <div className="relative p-6 pt-4">
          <div className="rounded-2xl border border-border bg-muted/50 p-4">
            <h3 className="text-lg font-bold text-foreground">{challenge.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{challenge.description}</p>
            
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                {challenge.duration}
              </div>
              {challenge.location && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {challenge.location}
                </div>
              )}
            </div>

            {/* Reward */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-green-500/20 px-3 py-1.5">
                <Sparkles className="h-4 w-4 text-green-500" />
                <span className="text-sm font-semibold text-green-500">
                  +{challenge.reward} 经验
                </span>
              </div>
              <span className="text-xs text-muted-foreground">获胜奖励</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDecline}
              className="flex-1 rounded-2xl border border-border bg-muted py-3.5 font-medium text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground active:scale-[0.98]"
            >
              拒绝
            </button>
            <button
              onClick={handleAccept}
              className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 py-3.5 font-semibold text-white shadow-lg shadow-green-500/30 transition-all hover:from-green-600 hover:to-green-500 active:scale-[0.98]"
            >
              接受挑战
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

/* Demo wrapper */
export function ChallengeInviteDemo() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-xl bg-green-500/20 px-4 py-2 text-sm font-medium text-green-500 transition-all hover:bg-green-500/30"
      >
        模拟挑战邀请
      </button>
      <ChallengeInvite
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        challenger={{
          name: "SpeedRunner",
          level: 15,
          wins: 28,
          clan: "闪电战队",
        }}
        challenge={{
          type: "race",
          title: "3公里竞速赛",
          description: "比拼谁能更快完成3公里跑步",
          duration: "30分钟",
          reward: 200,
          location: "中央公园",
        }}
      />
    </div>
  )
}
