"use client"

import React from "react"

import { useState, useEffect } from "react"
import {
  Swords,
  Timer,
  MapPin,
  Trophy,
  Zap,
  ArrowRight,
  Check,
  X,
  Clock,
  Target,
  Flame
} from "lucide-react"
import { toast } from "sonner"

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit, timeoutMs = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const fetchPendingChallenges = async () => {
  const res = await fetchWithTimeout('/api/social/pending-challenges', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch pending challenges')
  return await res.json()
}

const createChallenge = async (payload: { targetId: string; type: string; distance?: number; duration?: string; rewardXp?: number }) => {
  const res = await fetchWithTimeout('/api/social/create-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to create challenge')
  return await res.json()
}

const respondToChallenge = async (challengeId: string, accept: boolean) => {
  const res = await fetchWithTimeout('/api/social/respond-challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, accept }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to respond to challenge')
  return await res.json()
}


type ChallengeType = "race" | "territory" | "distance"

interface ChallengeOption {
  type: ChallengeType
  title: string
  description: string
  icon: React.ElementType
  color: string
  duration: string
  reward: number
}

const challengeOptions: ChallengeOption[] = [
  {
    type: "race",
    title: "竞速挑战",
    description: "比拼谁能更快完成指定距离",
    icon: Zap,
    color: "#22c55e",
    duration: "30分钟",
    reward: 200,
  },
  {
    type: "territory",
    title: "领地争夺",
    description: "在指定时间内占领更多领地",
    icon: MapPin,
    color: "#f59e0b",
    duration: "1小时",
    reward: 350,
  },
  {
    type: "distance",
    title: "里程比拼",
    description: "比拼谁能在规定时间跑得更远",
    icon: Target,
    color: "#8b5cf6",
    duration: "24小时",
    reward: 500,
  },
]

interface PendingChallenge {
  id: string
  from: {
    name: string
    level: number
    avatar?: string
  }
  type: ChallengeType
  distance?: number
  duration: string
  reward: number
  expiresIn: string
  location?: string
}

interface ChallengePageProps {
  selectedFriend?: {
    id?: string
    name: string
    level: number
    avatar?: string | null
  }
  onSendChallenge?: (type: ChallengeType, options: unknown) => void
  onAccept?: (challengeId: string) => void
  onDecline?: (challengeId: string) => void
}

export function ChallengePage({
  selectedFriend,
  onSendChallenge,
  onAccept,
  onDecline
}: ChallengePageProps) {
  const [selectedType, setSelectedType] = useState<ChallengeType | null>(null)
  const [distance, setDistance] = useState(3)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingChallenges, setPendingChallenges] = useState<PendingChallenge[]>([])

  // Mock data for active challenges with progress visualization
  const [activeChallenges] = useState([
    {
      id: "ac1",
      opponent: { name: "跑神阿甘", avatar: "🏃", level: 42 },
      type: "distance",
      title: "里程比拼",
      target: 10,
      current: 7.5,
      opponentCurrent: 8.2,
      expiresIn: "12:45:00",
      color: "#8b5cf6",
      icon: Target
    },
    {
      id: "ac2",
      opponent: { name: "夜跑狂魔", avatar: "🦇", level: 38 },
      type: "race",
      title: "竞速挑战 (5公里)",
      target: 5,
      current: 5,
      opponentCurrent: 4.1,
      expiresIn: "完成！",
      color: "#22c55e",
      icon: Zap
    }
  ])

  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const loadChallenges = async () => {
      try {
        const data = await fetchPendingChallenges()

        // Map DB response to UI model
        const mapped = data.map((c: any) => ({
          id: c.id,
          from: {
            name: c.from?.name || 'Unknown',
            level: c.from?.level || 1,
            avatar: c.from?.avatar
          },
          type: c.type as ChallengeType,
          distance: c.distance,
          duration: c.duration || '24h',
          reward: c.rewardXp || 100,
          expiresIn: c.expiresIn,
          location: 'City'
        }))
        setPendingChallenges(mapped)
      } catch (error) {
        console.error("Failed to load challenges", error)
      }
    }
    loadChallenges()
  }, [])

  const handleSendChallenge = async () => {
    if (selectedType && selectedFriend?.id) {
      setIsLoading(true)
      try {
        // Calculate reward based on options
        const option = challengeOptions.find(o => o.type === selectedType)

        await createChallenge({
          type: selectedType,
          targetId: selectedFriend.id,
          distance: selectedType === 'race' ? distance : undefined,
          duration: option?.duration,
          rewardXp: option?.reward || 100
        })

        onSendChallenge?.(selectedType, { distance })
        setShowConfirm(true)
        setTimeout(() => setShowConfirm(false), 2000)
        toast.success("挑战已发送")
      } catch (error) {
        toast.error("发送挑战失败")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleResponse = async (id: string, accept: boolean) => {
    try {
      await respondToChallenge(id, accept)
      setPendingChallenges(prev => prev.filter(c => c.id !== id))
      toast.success(accept ? "已接受挑战" : "已拒绝挑战")
      if (accept) onAccept?.(id)
      else onDecline?.(id)
    } catch (error) {
      toast.error("操作失败")
    }
  }

  return (
    <div className="space-y-6">
      {/* Active Challenges Section */}
      {activeChallenges.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Timer className="h-4 w-4" />
            进行中的挑战
          </h2>
          <div className="space-y-4">
            {activeChallenges.map(ac => {
              const Icon = ac.icon
              const myProgress = Math.min((ac.current / ac.target) * 100, 100)
              const oppProgress = Math.min((ac.opponentCurrent / ac.target) * 100, 100)
              const isWinner = ac.current >= ac.target && ac.current > ac.opponentCurrent

              return (
                <div key={ac.id} className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className={`absolute top-0 left-0 w-1 h-full`} style={{ backgroundColor: ac.color }} />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${ac.color}20`, color: ac.color }}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold">{ac.title}</div>
                        <div className="text-xs text-muted-foreground">vs {ac.opponent.name}</div>
                      </div>
                    </div>
                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded-md">
                      {ac.expiresIn}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* My Progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">我</span>
                        <span className="text-muted-foreground">{ac.current} / {ac.target}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 bg-primary"
                          style={{ width: `${myProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Opponent Progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">{ac.opponent.name}</span>
                        <span className="text-muted-foreground">{ac.opponentCurrent} / {ac.target}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 bg-destructive/60"
                          style={{ width: `${oppProgress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {myProgress >= 100 && (
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-sm font-bold text-green-500 flex items-center gap-1">
                        <Trophy className="w-4 h-4" /> 恭喜，你赢得了挑战！
                      </span>
                      <button className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg active:scale-95">
                        领奖
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending Challenges Section */}
      {pendingChallenges.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Swords className="h-4 w-4" />
            待处理的挑战 ({pendingChallenges.length})
          </h2>
          <div className="space-y-3">
            {pendingChallenges.map((challenge) => {
              const option = challengeOptions.find(o => o.type === challenge.type)!
              const Icon = option.icon

              return (
                <div
                  key={challenge.id}
                  className="overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-muted/50 to-muted/20"
                >
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${option.color}20` }}
                        >
                          <Icon className="h-5 w-5" style={{ color: option.color }} />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{option.title}</p>
                          <p className="text-xs text-muted-foreground">
                            来自 <span style={{ color: option.color }}>{challenge.from.name}</span>
                            <span className="ml-1 text-muted-foreground/60">Lv.{challenge.from.level}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                        <Clock className="h-3 w-3" />
                        {challenge.expiresIn}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2 text-xs">
                      {challenge.distance && (
                        <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                          {challenge.distance}公里
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        {challenge.duration}
                      </span>
                      {challenge.location && (
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {challenge.location}
                        </span>
                      )}
                      <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-1 text-yellow-600 dark:text-yellow-400">
                        <Trophy className="h-3 w-3" />
                        +{challenge.reward} XP
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResponse(challenge.id, true)}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 font-semibold text-white transition-all hover:bg-green-600 active:scale-[0.98]"
                      >
                        <Check className="h-4 w-4" />
                        接受挑战
                      </button>
                      <button
                        onClick={() => handleResponse(challenge.id, false)}
                        className="flex items-center justify-center rounded-xl bg-muted px-4 py-2.5 text-muted-foreground transition-all hover:bg-muted/80"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Send Challenge Section */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Flame className="h-4 w-4" />
          发起挑战
        </h2>

        {selectedFriend ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 text-lg font-bold text-green-500">
              {selectedFriend.avatar || selectedFriend.name[0]}
            </div>
            <div>
              <p className="font-semibold text-foreground">向 {selectedFriend.name} 发起挑战</p>
              <p className="text-xs text-muted-foreground">Lv.{selectedFriend.level}</p>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">请先从好友列表选择一位好友</p>
          </div>
        )}

        {/* Challenge Type Selection */}
        <div className="space-y-3">
          {challengeOptions.map((option) => {
            const Icon = option.icon
            const isSelected = selectedType === option.type

            return (
              <button
                key={option.type}
                onClick={() => setSelectedType(option.type)}
                disabled={!selectedFriend}
                className={`w-full rounded-2xl border p-4 text-left transition-all ${isSelected
                  ? "border-green-500 bg-green-500/10"
                  : "border-border bg-card hover:bg-muted/50"
                  } ${!selectedFriend ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${isSelected ? "bg-green-500/20" : "bg-muted"
                      }`}
                  >
                    <Icon className="h-6 w-6" style={{ color: isSelected ? "#22c55e" : option.color }} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{option.title}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground/80">{option.duration}</p>
                    <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">+{option.reward} XP</p>
                  </div>
                </div>

                {/* Distance selector for race type */}
                {isSelected && option.type === "race" && (
                  <div className="mt-4 border-t border-border pt-4" onClick={(e) => e.stopPropagation()}>
                    <p className="mb-2 text-xs text-muted-foreground">选择距离</p>
                    <div className="flex gap-2">
                      {[1, 3, 5, 10].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDistance(d)}
                          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${distance === d
                            ? "bg-green-500 text-white"
                            : "bg-muted text-foreground hover:bg-muted/80"
                            }`}
                        >
                          {d}公里
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Send Button */}
        <button
          onClick={handleSendChallenge}
          disabled={!selectedFriend || !selectedType}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition-all ${selectedFriend && selectedType
            ? "bg-green-500 text-white hover:bg-green-600 active:scale-[0.98]"
            : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
        >
          {showConfirm ? (
            <>
              <Check className="h-5 w-5" />
              挑战已发送！
            </>
          ) : (
            <>
              <Swords className="h-5 w-5" />
              发送挑战
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
