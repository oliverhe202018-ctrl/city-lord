"use client"

import { useState, useEffect } from "react"
import { 
  X, 
  Trophy, 
  Sparkles, 
  Share2, 
  Zap, 
  Star,
  Gift,
  ChevronRight,
  Crown
} from "lucide-react"

type AchievementRarity = "common" | "rare" | "epic" | "legendary"

interface AchievementReward {
  type: "xp" | "coins" | "badge" | "title"
  amount: number
  label: string
}

interface AchievementPopupProps {
  isOpen: boolean
  onClose: () => void
  achievement: {
    id: string
    title: string
    description: string
    icon?: string
    rarity: AchievementRarity
    unlockedAt?: string
  }
  rewards: AchievementReward[]
  onClaim?: () => void
  onShare?: () => void
}

const rarityConfig: Record<AchievementRarity, {
  color: string
  bg: string
  border: string
  glow: string
  label: string
  gradient: string
}> = {
  common: {
    color: "text-gray-300",
    bg: "bg-gray-400/20",
    border: "border-gray-400/30",
    glow: "shadow-gray-400/20",
    label: "普通",
    gradient: "from-gray-500/20 to-gray-600/10",
  },
  rare: {
    color: "text-blue-400",
    bg: "bg-blue-400/20",
    border: "border-blue-400/30",
    glow: "shadow-blue-400/30",
    label: "稀有",
    gradient: "from-blue-500/20 to-blue-600/10",
  },
  epic: {
    color: "text-purple-400",
    bg: "bg-purple-400/20",
    border: "border-purple-400/30",
    glow: "shadow-purple-400/30",
    label: "史诗",
    gradient: "from-purple-500/20 to-purple-600/10",
  },
  legendary: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/20",
    border: "border-yellow-400/40",
    glow: "shadow-yellow-400/40",
    label: "传奇",
    gradient: "from-yellow-500/30 via-orange-500/20 to-yellow-600/10",
  },
}

export function AchievementPopup({
  isOpen,
  onClose,
  achievement,
  rewards,
  onClaim,
  onShare,
}: AchievementPopupProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [isExiting, setIsExiting] = useState(false)
  const [isClaimed, setIsClaimed] = useState(false)
  const [showParticles, setShowParticles] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true)
      setIsExiting(false)
      setIsClaimed(false)
      // Trigger particles after popup appears
      setTimeout(() => setShowParticles(true), 300)
    } else {
      setShowParticles(false)
    }
  }, [isOpen])

  const handleClose = () => {
    setIsExiting(true)
    setShowParticles(false)
    setTimeout(() => {
      setIsAnimating(false)
      onClose()
    }, 400)
  }

  const handleClaim = () => {
    setIsClaimed(true)
    onClaim?.()
    // Auto close after claim animation
    setTimeout(handleClose, 1500)
  }

  if (!isOpen && !isAnimating) return null

  const config = rarityConfig[achievement.rarity]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-400 ${
          isExiting ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
      />

      {/* Particle effects */}
      {showParticles && !isExiting && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`absolute h-2 w-2 rounded-full ${config.bg} animate-[float_3s_ease-out_forwards]`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Achievement Card */}
      <div
        className={`relative w-full max-w-sm transform overflow-hidden rounded-3xl border ${config.border} bg-gradient-to-b ${config.gradient} to-black/95 shadow-2xl ${config.glow} backdrop-blur-xl transition-all duration-400 ${
          isExiting
            ? "scale-90 opacity-0 rotate-3"
            : isClaimed
              ? "scale-105"
              : "scale-100 opacity-100"
        }`}
      >
        {/* Animated background rays */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute inset-0 animate-[spin_20s_linear_infinite] opacity-20`}>
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className={`absolute left-1/2 top-1/2 h-full w-1 -translate-x-1/2 origin-bottom ${config.bg}`}
                style={{ transform: `rotate(${i * 30}deg)` }}
              />
            ))}
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white/60 transition-all hover:bg-white/20 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="relative p-6">
          {/* Header */}
          <div className="text-center">
            <p className={`text-sm font-medium uppercase tracking-wider ${config.color}`}>
              成就解锁
            </p>
            
            {/* Achievement icon with glow */}
            <div className="relative mx-auto mt-4">
              <div className={`absolute inset-0 animate-pulse rounded-full ${config.bg} blur-2xl`} />
              <div className={`relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 ${config.border} ${config.bg}`}>
                {achievement.icon ? (
                  <span className="text-5xl">{achievement.icon}</span>
                ) : achievement.rarity === "legendary" ? (
                  <Crown className={`h-14 w-14 ${config.color}`} />
                ) : (
                  <Trophy className={`h-14 w-14 ${config.color}`} />
                )}
              </div>
              
              {/* Rarity badge */}
              <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full ${config.bg} ${config.border} border px-3 py-1`}>
                <span className={`text-xs font-bold ${config.color}`}>
                  {config.label}
                </span>
              </div>
            </div>

            {/* Achievement title & description */}
            <h2 className="mt-6 text-2xl font-bold text-white">
              {achievement.title}
            </h2>
            <p className="mt-2 text-sm text-white/60">
              {achievement.description}
            </p>
            {achievement.unlockedAt && (
              <p className="mt-1 text-xs text-white/40">
                解锁于 {achievement.unlockedAt}
              </p>
            )}
          </div>

          {/* Rewards */}
          <div className="mt-6">
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-white/40">
              奖励预览
            </p>
            <div className="grid grid-cols-2 gap-2">
              {rewards.map((reward, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 p-3 transition-all ${
                    isClaimed ? "border-[#22c55e]/30 bg-[#22c55e]/10" : ""
                  }`}
                >
                  <div className={`rounded-lg ${isClaimed ? "bg-[#22c55e]/20" : "bg-white/10"} p-2`}>
                    {reward.type === "xp" && <Zap className={`h-4 w-4 ${isClaimed ? "text-[#22c55e]" : "text-cyan-400"}`} />}
                    {reward.type === "coins" && <Sparkles className={`h-4 w-4 ${isClaimed ? "text-[#22c55e]" : "text-yellow-400"}`} />}
                    {reward.type === "badge" && <Star className={`h-4 w-4 ${isClaimed ? "text-[#22c55e]" : "text-purple-400"}`} />}
                    {reward.type === "title" && <Crown className={`h-4 w-4 ${isClaimed ? "text-[#22c55e]" : "text-orange-400"}`} />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${isClaimed ? "text-[#22c55e]" : "text-white"}`}>
                      +{reward.amount}
                    </p>
                    <p className="text-xs text-white/50">{reward.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 space-y-3">
            {!isClaimed ? (
              <button
                onClick={handleClaim}
                className={`group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r ${
                  achievement.rarity === "legendary"
                    ? "from-yellow-500 to-orange-500"
                    : "from-[#22c55e] to-[#16a34a]"
                } py-4 font-bold text-black shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]`}
              >
                <Gift className="h-5 w-5 transition-transform group-hover:rotate-12" />
                领取奖励
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-[#22c55e]/20 py-4 text-[#22c55e]">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <span className="font-bold">奖励已领取!</span>
              </div>
            )}
            
            <button
              onClick={onShare}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" />
              分享成就
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-100px) scale(0);
          }
        }
      `}</style>
    </div>
  )
}

/* Demo wrapper */
export function AchievementPopupDemo() {
  const [isOpen, setIsOpen] = useState(false)
  const [rarity, setRarity] = useState<AchievementRarity>("legendary")

  const achievements: Record<AchievementRarity, { title: string; description: string; icon: string }> = {
    common: { title: "初出茅庐", description: "完成你的第一次跑步", icon: "🏃" },
    rare: { title: "领地先锋", description: "占领你的前10个领地", icon: "🏴" },
    epic: { title: "马拉松英雄", description: "累计跑步达到42.195公里", icon: "🏅" },
    legendary: { title: "城市霸主", description: "同时拥有500个领地，成为真正的城市之王", icon: "👑" },
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(["common", "rare", "epic", "legendary"] as const).map((r) => (
        <button
          key={r}
          onClick={() => {
            setRarity(r)
            setIsOpen(true)
          }}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
            rarityConfig[r].bg
          } ${rarityConfig[r].color} hover:opacity-80`}
        >
          {rarityConfig[r].label}成就
        </button>
      ))}
      <AchievementPopup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        achievement={{
          id: "demo",
          ...achievements[rarity],
          rarity,
          unlockedAt: "2025年1月25日",
        }}
        rewards={[
          { type: "xp", amount: rarity === "legendary" ? 1000 : rarity === "epic" ? 500 : rarity === "rare" ? 200 : 50, label: "经验值" },
          { type: "coins", amount: rarity === "legendary" ? 500 : rarity === "epic" ? 200 : rarity === "rare" ? 100 : 25, label: "金币" },
          ...(rarity === "legendary" || rarity === "epic" ? [{ type: "badge" as const, amount: 1, label: "专属徽章" }] : []),
          ...(rarity === "legendary" ? [{ type: "title" as const, amount: 1, label: "专属称号" }] : []),
        ]}
      />
    </div>
  )
}
