"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { User } from "lucide-react"
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
  Flame,
  Loader2,
  Inbox,
} from "lucide-react"
import { toast } from "sonner"

import { useGameStore } from "@/store/useGameStore"
import {
  getActiveChallenges,
  getPendingChallengesForUser,
  acceptChallenge as acceptChallengeAction,
  declineChallenge as declineChallengeAction,
  createChallenge as createChallengeAction,
} from "@/app/actions/challenge-service"
import type {
  ChallengeWithProfiles,
  ChallengeType as DbChallengeType,
} from "@/types/challenge"

// ─── UI-level challenge type (maps to DB ChallengeType) ─────────────────────

type UIChallengeType = "race" | "territory" | "distance"

/** Map UI type → DB type */
function uiTypeToDbType(uiType: UIChallengeType): DbChallengeType {
  switch (uiType) {
    case "race":
      return "PACE"
    case "territory":
      return "HEXES"
    case "distance":
      return "DISTANCE"
  }
}

/** Map DB type → UI type */
function dbTypeToUiType(dbType: DbChallengeType): UIChallengeType {
  switch (dbType) {
    case "PACE":
      return "race"
    case "HEXES":
      return "territory"
    case "DISTANCE":
      return "distance"
  }
}

// ─── Challenge option definitions ───────────────────────────────────────────

interface ChallengeOption {
  type: UIChallengeType
  title: string
  description: string
  icon: React.ElementType
  color: string
  duration: string
  reward: number
  /** Default target_value to send to DB */
  defaultTargetValue: number
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
    defaultTargetValue: 360, // 6:00 min/km in seconds
  },
  {
    type: "territory",
    title: "领地争夺",
    description: "在指定时间内占领更多领地",
    icon: MapPin,
    color: "#f59e0b",
    duration: "1小时",
    reward: 350,
    defaultTargetValue: 10, // 10 hexes
  },
  {
    type: "distance",
    title: "里程比拼",
    description: "比拼谁能在规定时间跑得更远",
    icon: Target,
    color: "#8b5cf6",
    duration: "24小时",
    reward: 500,
    defaultTargetValue: 5000, // 5km in meters
  },
]

// ─── Avatar resolver helper ─────────────────────────────────────────────────

function resolveAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith("http")) return avatarUrl
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${avatarUrl}`
}

// ─── Format countdown helper ────────────────────────────────────────────────

function formatCountdown(deadlineIso: string | null): string {
  if (!deadlineIso) return "—"
  const remaining = new Date(deadlineIso).getTime() - Date.now()
  if (remaining <= 0) return "已结束"
  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000)
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

/** Format progress value for display based on challenge type */
function formatProgress(value: number, dbType: DbChallengeType): string {
  switch (dbType) {
    case "DISTANCE":
      return (value / 1000).toFixed(1) // meters → km
    case "HEXES":
      return String(Math.floor(value))
    case "PACE":
      if (value <= 0) return "—"
      const mins = Math.floor(value / 60)
      const secs = Math.floor(value % 60)
      return `${mins}'${String(secs).padStart(2, "0")}"`
  }
}

/** Format target value for display based on challenge type */
function formatTarget(value: number, dbType: DbChallengeType): string {
  switch (dbType) {
    case "DISTANCE":
      return `${(value / 1000).toFixed(1)}km`
    case "HEXES":
      return `${value} 格`
    case "PACE":
      const mins = Math.floor(value / 60)
      const secs = Math.floor(value % 60)
      return `${mins}'${String(secs).padStart(2, "0")}"/km`
  }
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ChallengePageProps {
  selectedFriend?: {
    id?: string
    name: string
    level: number
    avatar?: string | null
  }
  onSendChallenge?: (type: UIChallengeType, options: unknown) => void
  onAccept?: (challengeId: string) => void
  onDecline?: (challengeId: string) => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ChallengePage({
  selectedFriend,
  onSendChallenge,
  onAccept,
  onDecline,
}: ChallengePageProps) {
  const userId = useGameStore((s) => s.userId)

  // ── Data states ──
  const [activeChallenges, setActiveChallenges] = useState<ChallengeWithProfiles[]>([])
  const [pendingChallenges, setPendingChallenges] = useState<ChallengeWithProfiles[]>([])

  // ── Loading states ──
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [respondingId, setRespondingId] = useState<string | null>(null)

  // ── Create challenge form state ──
  const [selectedType, setSelectedType] = useState<UIChallengeType | null>(null)
  const [distance, setDistance] = useState(3)
  const [showConfirm, setShowConfirm] = useState(false)

  // ── Countdown tick ──
  const [, setTick] = useState(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Data fetching ──

  const loadAllData = useCallback(async () => {
    if (!userId) return
    try {
      const [activeData, pendingData] = await Promise.all([
        getActiveChallenges(userId),
        getPendingChallengesForUser(),
      ])
      setActiveChallenges(activeData)
      setPendingChallenges(pendingData)
    } catch (error) {
      console.error("[ChallengePage] Failed to load data:", error)
    }
  }, [userId])

  // Initial fetch
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      setIsInitialLoading(true)
      await loadAllData()
      if (!cancelled) setIsInitialLoading(false)
    }
    init()
    return () => { cancelled = true }
  }, [loadAllData])

  // Countdown timer: tick every second when there are active challenges
  useEffect(() => {
    if (activeChallenges.length > 0) {
      tickRef.current = setInterval(() => setTick((t) => t + 1), 1000)
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [activeChallenges.length])

  // ── Handlers ──

  const handleSendChallenge = async () => {
    if (!selectedType || !selectedFriend?.id) return
    setIsSubmitting(true)
    try {
      const option = challengeOptions.find((o) => o.type === selectedType)!
      const dbType = uiTypeToDbType(selectedType)

      // For distance/race challenges, use user-selected distance (convert km → meters for DISTANCE)
      let targetValue = option.defaultTargetValue
      if (selectedType === "distance") {
        targetValue = distance * 1000 // km → meters
      } else if (selectedType === "race") {
        targetValue = distance * 1000 // km → meters (PACE challenge uses distance as well)
      }

      const result = await createChallengeAction({
        target_id: selectedFriend.id,
        type: dbType,
        target_value: targetValue,
        reward_xp: option.reward,
      })

      if (result.success) {
        onSendChallenge?.(selectedType, { distance })
        setShowConfirm(true)
        setTimeout(() => setShowConfirm(false), 2000)
        toast.success("挑战已发送！")
        await loadAllData()
      } else {
        toast.error(result.error || "发送挑战失败")
      }
    } catch (error) {
      toast.error("发送挑战失败")
      console.error("[ChallengePage] createChallenge error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAccept = async (challengeId: string) => {
    setRespondingId(challengeId)
    try {
      const result = await acceptChallengeAction(challengeId)
      if (result.success) {
        toast.success("已接受挑战，战斗开始！⚔️")
        onAccept?.(challengeId)
        await loadAllData()
      } else {
        toast.error(result.error || "操作失败")
      }
    } catch (error) {
      toast.error("操作失败")
      console.error("[ChallengePage] acceptChallenge error:", error)
    } finally {
      setRespondingId(null)
    }
  }

  const handleDecline = async (challengeId: string) => {
    setRespondingId(challengeId)
    try {
      const result = await declineChallengeAction(challengeId)
      if (result.success) {
        toast.success("已拒绝挑战")
        onDecline?.(challengeId)
        await loadAllData()
      } else {
        toast.error(result.error || "操作失败")
      }
    } catch (error) {
      toast.error("操作失败")
      console.error("[ChallengePage] declineChallenge error:", error)
    } finally {
      setRespondingId(null)
    }
  }

  // ── Loading state ──

  if (isInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">加载挑战数据中...</p>
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* ═══ Active Challenges Section ═══ */}
      {activeChallenges.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
            <Timer className="h-4 w-4" />
            进行中的挑战
          </h2>
          <div className="space-y-4">
            {activeChallenges.map((challenge) => {
              // ── Identity determination ──
              const isChallenger = userId === challenge.challenger_id
              const myProgress = isChallenger
                ? challenge.challenger_progress
                : challenge.target_progress
              const oppProgress = isChallenger
                ? challenge.target_progress
                : challenge.challenger_progress
              const opponent = isChallenger
                ? challenge.target
                : challenge.challenger

              const uiType = dbTypeToUiType(challenge.type)
              const option = challengeOptions.find((o) => o.type === uiType)!
              const Icon = option.icon

              // ── Progress percentage ──
              const myPct = Math.min(
                (myProgress / challenge.target_value) * 100,
                100
              )
              const oppPct = Math.min(
                (oppProgress / challenge.target_value) * 100,
                100
              )

              // ── Countdown ──
              const countdown = formatCountdown(challenge.deadline)

              // ── Avatar ──
              const oppAvatarUrl = resolveAvatarUrl(opponent.avatar_url)

              return (
                <div
                  key={challenge.id}
                  className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{ backgroundColor: option.color }}
                  />

                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="p-1.5 rounded-lg"
                        style={{
                          backgroundColor: `${option.color}20`,
                          color: option.color,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          {option.title}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                          vs
                          {oppAvatarUrl ? (
                            <img
                              src={oppAvatarUrl}
                              alt={opponent.nickname}
                              className="h-4 w-4 rounded-full object-cover inline-block"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          ) : null}
                          <span>{opponent.nickname}</span>
                          <span className="text-muted-foreground/50">
                            Lv.{opponent.level}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-mono bg-muted px-2 py-1 rounded-md text-foreground">
                      {countdown}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* My Progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-foreground">我</span>
                        <span className="text-muted-foreground">
                          {formatProgress(myProgress, challenge.type)} /{" "}
                          {formatTarget(challenge.target_value, challenge.type)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 bg-primary"
                          style={{ width: `${myPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Opponent Progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-foreground">
                          {opponent.nickname}
                        </span>
                        <span className="text-muted-foreground">
                          {formatProgress(oppProgress, challenge.type)} /{" "}
                          {formatTarget(challenge.target_value, challenge.type)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000 bg-destructive/60"
                          style={{ width: `${oppPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Victory banner */}
                  {myPct >= 100 && (
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <span className="text-sm font-bold text-green-500 flex items-center gap-1">
                        <Trophy className="w-4 h-4" /> 恭喜，你赢得了挑战！
                      </span>
                      <span className="text-xs bg-green-500/20 text-green-500 px-3 py-1.5 rounded-lg font-medium">
                        +{challenge.reward_xp} XP
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Pending Challenges Section ═══ */}
      {pendingChallenges.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
            <Swords className="h-4 w-4" />
            待处理的挑战 ({pendingChallenges.length})
          </h2>
          <div className="space-y-3">
            {pendingChallenges.map((challenge) => {
              const from = challenge.challenger // Pending → challenger sent it
              const uiType = dbTypeToUiType(challenge.type)
              const option = challengeOptions.find((o) => o.type === uiType)!
              const Icon = option.icon
              const avatarUrl = resolveAvatarUrl(from.avatar_url)
              const isResponding = respondingId === challenge.id

              // Calculate expires-in from created_at (48h TTL)
              const createdAt = new Date(challenge.created_at).getTime()
              const expiresInMs = createdAt + 48 * 60 * 60 * 1000 - Date.now()
              const expiresInStr =
                expiresInMs <= 0
                  ? "已过期"
                  : expiresInMs < 60 * 60 * 1000
                    ? `${Math.floor(expiresInMs / (60 * 1000))}分钟`
                    : `${Math.floor(expiresInMs / (60 * 60 * 1000))}小时`

              return (
                <div
                  key={challenge.id}
                  className="overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-muted/50 to-muted/20"
                >
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Challenger Avatar */}
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={from.nickname}
                            className="h-10 w-10 rounded-full object-cover shrink-0 border border-border"
                            onError={(e) => {
                              ;(e.target as HTMLImageElement).style.display = "none"
                              const fallback = (e.target as HTMLImageElement)
                                .nextElementSibling
                              if (fallback)
                                fallback.classList.remove("hidden")
                            }}
                          />
                        ) : null}
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${avatarUrl ? "hidden" : ""}`}
                          style={{ backgroundColor: `${option.color}20` }}
                        >
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {option.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            来自{" "}
                            <span style={{ color: option.color }}>
                              {from.nickname}
                            </span>
                            <span className="ml-1 text-muted-foreground/60">
                              Lv.{from.level}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                        <Clock className="h-3 w-3" />
                        {expiresInStr}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                        目标: {formatTarget(challenge.target_value, challenge.type)}
                      </span>
                      <span className="flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-1 text-yellow-600 dark:text-yellow-400">
                        <Trophy className="h-3 w-3" />+{challenge.reward_xp} XP
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(challenge.id)}
                        disabled={isResponding}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 font-semibold text-white transition-all hover:bg-green-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isResponding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        接受挑战
                      </button>
                      <button
                        onClick={() => handleDecline(challenge.id)}
                        disabled={isResponding}
                        className="flex items-center justify-center rounded-xl bg-muted px-4 py-2.5 text-muted-foreground transition-all hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isResponding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ Empty State ═══ */}
      {activeChallenges.length === 0 && pendingChallenges.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
          <Inbox className="h-8 w-8 opacity-40" />
          <p className="text-sm">暂无挑战</p>
          <p className="text-xs opacity-60">选择好友发起一场 1v1 对决吧！</p>
        </div>
      )}

      {/* ═══ Send Challenge Section ═══ */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-gray-100">
          <Flame className="h-4 w-4" />
          发起挑战
        </h2>

        {selectedFriend ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3">
            {(() => {
              const resolvedUrl = resolveAvatarUrl(selectedFriend.avatar)
              return resolvedUrl ? (
                <img
                  src={resolvedUrl}
                  alt={selectedFriend.name}
                  className="h-10 w-10 rounded-full object-cover shrink-0 border border-green-500/30"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                    const fallback = (e.target as HTMLImageElement)
                      .nextElementSibling
                    if (fallback) fallback.classList.remove("hidden")
                  }}
                />
              ) : null
            })()}
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 text-lg font-bold text-green-500 shrink-0 ${selectedFriend.avatar ? "hidden" : ""}`}
            >
              {selectedFriend.name[0]}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                向 {selectedFriend.name} 发起挑战
              </p>
              <p className="text-xs text-muted-foreground">
                Lv.{selectedFriend.level}
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              请先从好友列表选择一位好友
            </p>
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
                className={`w-full rounded-2xl border p-4 text-left transition-all ${
                  isSelected
                    ? "border-green-500 bg-green-500/10"
                    : "border-border bg-card hover:bg-muted/50"
                } ${!selectedFriend ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                      isSelected ? "bg-green-500/20" : "bg-muted"
                    }`}
                  >
                    <Icon
                      className="h-6 w-6"
                      style={{
                        color: isSelected ? "#22c55e" : option.color,
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {option.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground/80">
                      {option.duration}
                    </p>
                    <p className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                      +{option.reward} XP
                    </p>
                  </div>
                </div>

                {/* Distance selector for race/distance type */}
                {isSelected &&
                  (option.type === "race" || option.type === "distance") && (
                    <div
                      className="mt-4 border-t border-border pt-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="mb-2 text-xs text-muted-foreground">
                        选择距离
                      </p>
                      <div className="flex gap-2">
                        {[1, 3, 5, 10].map((d) => (
                          <button
                            key={d}
                            onClick={() => setDistance(d)}
                            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                              distance === d
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
          disabled={!selectedFriend || !selectedType || isSubmitting}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold transition-all ${
            selectedFriend && selectedType && !isSubmitting
              ? "bg-green-500 text-white hover:bg-green-600 active:scale-[0.98]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {showConfirm ? (
            <>
              <Check className="h-5 w-5" />
              挑战已发送！
            </>
          ) : isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              发送中...
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
