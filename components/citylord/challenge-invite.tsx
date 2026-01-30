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
  race: { icon: Zap, color: "text-cyan-400", bg: "bg-cyan-400/20", label: "竞速挑战" },
  capture: { icon: MapPin, color: "text-purple-400", bg: "bg-purple-400/20", label: "占领挑战" },
  distance: { icon: Trophy, color: "text-yellow-400", bg: "bg-yellow-400/20", label: "里程挑战" },
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
        className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleDecline}
      />

      {/* Card - slides up on mobile */}
      <div
        className={`relative w-full max-w-sm transform overflow-hidden rounded-3xl border border-[#22c55e]/30 bg-gradient-to-b from-[#22c55e]/10 to-black/95 shadow-2xl shadow-[#22c55e]/10 backdrop-blur-xl transition-all duration-300 ${
          isExiting
            ? "scale-95 opacity-0 translate-y-8"
            : "scale-100 opacity-100 translate-y-0"
        }`}
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -inset-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
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
                stroke="rgba(255,255,255,0.1)"
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
            <span className="text-xs font-bold text-[#22c55e]">{countdown}</span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleDecline}
          className="absolute left-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/60 transition-all hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header with challenger */}
        <div className="relative px-6 pt-8">
          <div className="flex flex-col items-center">
            {/* Challenger avatar with glow */}
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-[#22c55e]/30 blur-xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-2 border-[#22c55e]/50 bg-gradient-to-br from-[#22c55e]/30 to-[#22c55e]/10">
                {challenger.avatar ? (
                  <span className="text-3xl">{challenger.avatar}</span>
                ) : (
                  <User className="h-10 w-10 text-[#22c55e]" />
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
                <span className="text-lg font-bold text-white">{challenger.name}</span>
                {challenger.clan && (
                  <span className="rounded bg-[#22c55e]/20 px-1.5 py-0.5 text-xs font-medium text-[#22c55e]">
                    [{challenger.clan}]
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-white/50">
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
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <h3 className="text-lg font-bold text-white">{challenge.title}</h3>
            <p className="mt-1 text-sm text-white/60">{challenge.description}</p>
            
            <div className="mt-3 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-white/50">
                <Clock className="h-4 w-4" />
                {challenge.duration}
              </div>
              {challenge.location && (
                <div className="flex items-center gap-1.5 text-white/50">
                  <MapPin className="h-4 w-4" />
                  {challenge.location}
                </div>
              )}
            </div>

            {/* Reward */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-full bg-[#22c55e]/20 px-3 py-1.5">
                <Sparkles className="h-4 w-4 text-[#22c55e]" />
                <span className="text-sm font-semibold text-[#22c55e]">
                  +{challenge.reward} 经验
                </span>
              </div>
              <span className="text-xs text-white/40">获胜奖励</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleDecline}
              className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3.5 font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              拒绝
            </button>
            <button
              onClick={handleAccept}
              className="group flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] py-3.5 font-semibold text-black shadow-lg shadow-[#22c55e]/30 transition-all hover:from-[#16a34a] hover:to-[#22c55e] active:scale-[0.98]"
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
        className="rounded-xl bg-[#22c55e]/20 px-4 py-2 text-sm font-medium text-[#22c55e] transition-all hover:bg-[#22c55e]/30"
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
