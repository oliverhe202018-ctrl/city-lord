"use client"

import { useState, useEffect } from "react"
import {
  Swords,
  MapPin,
  Clock,
  Zap,
  Play,
  Shield,
  Trophy,
  ChevronRight,
  User,
  Hexagon,
  Timer,
  Footprints,
  Target,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react"

type BattleStatus = "pending" | "in_progress" | "success" | "failed" | "expired"

interface OccupiedTerritory {
  id: string
  name: string
  coordinates: string
  occupiedAt: string
  occupier: {
    name: string
    level: number
    clan?: string
    avatar?: string
  }
  expiresIn: number // seconds
  requiredDistance: number // meters
}

interface CounterAttackProgress {
  status: BattleStatus
  distanceRun: number
  requiredDistance: number
  timeElapsed: number
  hexesCaptured: number
  targetHexes: number
}

// Counter Attack Summary Page
interface CounterAttackPageProps {
  territories?: OccupiedTerritory[]
  onStartCounterAttack?: (territoryId: string) => void
  onViewMap?: (territoryId: string) => void
}

export function CounterAttackPage({
  territories = sampleTerritories,
  onStartCounterAttack,
  onViewMap,
}: CounterAttackPageProps) {
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null)

  const urgentCount = territories.filter((t) => t.expiresIn < 3600).length

  return (
    <div className="space-y-4">
      {/* Header Alert */}
      {urgentCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-red-400">紧急警报</p>
            <p className="text-sm text-white/60">
              {urgentCount} 个领地将在1小时内过期失效
            </p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{territories.length}</p>
          <p className="text-xs text-white/50">被占领</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{urgentCount}</p>
          <p className="text-xs text-white/50">即将过期</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
          <p className="text-2xl font-bold text-[#22c55e]">0</p>
          <p className="text-xs text-white/50">反击中</p>
        </div>
      </div>

      {/* Territory List */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/60">被占领的领地</h3>
        {territories.map((territory) => (
          <TerritoryCard
            key={territory.id}
            territory={territory}
            isSelected={selectedTerritory === territory.id}
            onSelect={() =>
              setSelectedTerritory(
                selectedTerritory === territory.id ? null : territory.id
              )
            }
            onStartCounterAttack={() => onStartCounterAttack?.(territory.id)}
            onViewMap={() => onViewMap?.(territory.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface TerritoryCardProps {
  territory: OccupiedTerritory
  isSelected: boolean
  onSelect: () => void
  onStartCounterAttack: () => void
  onViewMap: () => void
}

function TerritoryCard({
  territory,
  isSelected,
  onSelect,
  onStartCounterAttack,
  onViewMap,
}: TerritoryCardProps) {
  const [timeLeft, setTimeLeft] = useState(territory.expiresIn)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) return `${hours}小时${minutes}分`
    if (minutes > 0) return `${minutes}分${secs}秒`
    return `${secs}秒`
  }

  const isUrgent = timeLeft < 3600
  const isExpired = timeLeft === 0

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition-all ${
        isUrgent
          ? "border-red-500/30 bg-red-500/5"
          : "border-white/10 bg-black/40"
      }`}
    >
      <button onClick={onSelect} className="w-full p-4 text-left">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              isUrgent ? "bg-red-500/20" : "bg-white/10"
            }`}
          >
            <Hexagon
              className={`h-6 w-6 ${isUrgent ? "text-red-400" : "text-white/60"}`}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{territory.name}</h4>
              <span className="font-mono text-xs text-white/40">
                {territory.coordinates}
              </span>
            </div>

            {/* Occupier info */}
            <div className="mt-1 flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-[10px] font-bold text-red-400">
                {territory.occupier.name.charAt(0)}
              </div>
              <span className="text-sm text-red-400">{territory.occupier.name}</span>
              <span className="text-xs text-white/40">
                Lv.{territory.occupier.level}
              </span>
            </div>
          </div>

          {/* Countdown */}
          <div className="text-right">
            <div
              className={`flex items-center gap-1 ${
                isExpired
                  ? "text-white/40"
                  : isUrgent
                    ? "text-red-400"
                    : "text-yellow-400"
              }`}
            >
              <Timer className="h-4 w-4" />
              <span className="font-mono text-sm font-semibold">
                {isExpired ? "已过期" : formatTime(timeLeft)}
              </span>
            </div>
            <p className="text-[10px] text-white/40">反击剩余时间</p>
          </div>
        </div>
      </button>

      {/* Expanded Actions */}
      {isSelected && (
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-white/60">反击需要跑步</span>
            <span className="font-semibold text-[#22c55e]">
              {territory.requiredDistance}米
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onStartCounterAttack}
              disabled={isExpired}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-semibold transition-all ${
                isExpired
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#22c55e] to-cyan-500 text-black hover:opacity-90 active:scale-[0.98]"
              }`}
            >
              <Zap className="h-5 w-5" />
              立即反击
            </button>
            <button
              onClick={onViewMap}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-medium text-white/70 transition-all hover:bg-white/10"
            >
              <MapPin className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Counter Attack Progress Component
interface CounterAttackProgressProps {
  progress: CounterAttackProgress
  territory: OccupiedTerritory
  onPause?: () => void
  onResume?: () => void
  onViewResult?: () => void
}

export function CounterAttackProgressView({
  progress,
  territory,
  onPause,
  onViewResult,
}: CounterAttackProgressProps) {
  const distancePercent = (progress.distanceRun / progress.requiredDistance) * 100
  const hexPercent = (progress.hexesCaptured / progress.targetHexes) * 100

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const statusConfig = {
    pending: { color: "text-yellow-400", bg: "bg-yellow-400/20", label: "准备中" },
    in_progress: { color: "text-cyan-400", bg: "bg-cyan-400/20", label: "反击中" },
    success: { color: "text-[#22c55e]", bg: "bg-[#22c55e]/20", label: "反击成功" },
    failed: { color: "text-red-400", bg: "bg-red-400/20", label: "反击失败" },
    expired: { color: "text-white/40", bg: "bg-white/10", label: "已过期" },
  }

  const config = statusConfig[progress.status]

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div
        className={`flex items-center justify-between rounded-2xl border ${
          progress.status === "in_progress"
            ? "border-cyan-500/30 bg-cyan-500/5"
            : progress.status === "success"
              ? "border-[#22c55e]/30 bg-[#22c55e]/5"
              : "border-white/10 bg-black/40"
        } p-4`}
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-xl ${config.bg} p-3`}>
            {progress.status === "success" ? (
              <CheckCircle2 className={`h-6 w-6 ${config.color}`} />
            ) : progress.status === "in_progress" ? (
              <Swords className={`h-6 w-6 ${config.color} animate-pulse`} />
            ) : (
              <Shield className={`h-6 w-6 ${config.color}`} />
            )}
          </div>
          <div>
            <p className={`font-semibold ${config.color}`}>{config.label}</p>
            <p className="text-sm text-white/60">{territory.name}</p>
          </div>
        </div>

        {progress.status === "in_progress" && (
          <button
            onClick={onPause}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/20"
          >
            暂停
          </button>
        )}
      </div>

      {/* Live Stats */}
      {progress.status === "in_progress" && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
            <Clock className="mx-auto mb-1 h-5 w-5 text-white/40" />
            <p className="font-mono text-xl font-bold text-white">
              {formatTime(progress.timeElapsed)}
            </p>
            <p className="text-[10px] text-white/50">时长</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
            <Footprints className="mx-auto mb-1 h-5 w-5 text-cyan-400" />
            <p className="font-mono text-xl font-bold text-cyan-400">
              {progress.distanceRun}m
            </p>
            <p className="text-[10px] text-white/50">已跑距离</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
            <Hexagon className="mx-auto mb-1 h-5 w-5 text-[#22c55e]" />
            <p className="font-mono text-xl font-bold text-[#22c55e]">
              {progress.hexesCaptured}
            </p>
            <p className="text-[10px] text-white/50">已夺回</p>
          </div>
        </div>
      )}

      {/* Progress Bars */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
        {/* Distance Progress */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-white/60">跑步进度</span>
            <span className="font-semibold text-cyan-400">
              {progress.distanceRun} / {progress.requiredDistance}m
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-[#22c55e] transition-all"
              style={{ width: `${Math.min(distancePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Hex Capture Progress */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-white/60">领地夺回</span>
            <span className="font-semibold text-[#22c55e]">
              {progress.hexesCaptured} / {progress.targetHexes}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#22c55e] transition-all"
              style={{ width: `${Math.min(hexPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Target Info */}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
          反击目标
        </p>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-lg font-bold text-red-400">
            {territory.occupier.name.charAt(0)}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white">{territory.occupier.name}</p>
            <p className="text-sm text-white/50">等级 {territory.occupier.level}</p>
          </div>
          <Target className="h-5 w-5 text-red-400" />
        </div>
      </div>

      {/* Success/Failure Actions */}
      {(progress.status === "success" || progress.status === "failed") && (
        <div className="space-y-2">
          <button
            onClick={onViewResult}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-semibold transition-all ${
              progress.status === "success"
                ? "bg-gradient-to-r from-[#22c55e] to-cyan-500 text-black"
                : "bg-white/10 text-white"
            }`}
          >
            {progress.status === "success" ? (
              <>
                <Trophy className="h-5 w-5" />
                查看战绩
              </>
            ) : (
              <>
                <Swords className="h-5 w-5" />
                再次反击
              </>
            )}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// Sample data
const sampleTerritories: OccupiedTerritory[] = [
  {
    id: "1",
    name: "中央广场",
    coordinates: "H7-K3",
    occupiedAt: "2025-01-25 10:30",
    occupier: {
      name: "NightHunter",
      level: 12,
      clan: "暗影军团",
    },
    expiresIn: 1800, // 30 minutes
    requiredDistance: 500,
  },
  {
    id: "2",
    name: "科技园区",
    coordinates: "D4-F8",
    occupiedAt: "2025-01-25 09:15",
    occupier: {
      name: "SpeedDemon",
      level: 15,
    },
    expiresIn: 7200, // 2 hours
    requiredDistance: 800,
  },
  {
    id: "3",
    name: "滨江步道",
    coordinates: "A2-C5",
    occupiedAt: "2025-01-24 22:00",
    occupier: {
      name: "GridMaster",
      level: 18,
      clan: "闪电战队",
    },
    expiresIn: 14400, // 4 hours
    requiredDistance: 1000,
  },
]
