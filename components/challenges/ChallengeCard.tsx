"use client"

import React from "react"
import type { Challenge } from "@/types/city"
import { useCity } from "@/contexts/CityContext"
import { Swords, Shield, Compass, Users, Clock, Star, Zap, Lock } from "lucide-react"
import { X } from "lucide-react"

/**
 * 挑战卡片组件
 */
export interface ChallengeCardProps {
  challenge: Challenge
  progress?: number // 当前进度（0-100）
  onClick?: () => void
  compact?: boolean // 紧凑模式
}

/**
 * 挑战类型图标映射
 */
const challengeTypeIcons: Record<string, React.ElementType> = {
  conquest: Swords,
  defense: Shield,
  exploration: Compass,
  social: Users,
  daily: Clock,
}

/**
 * 挑战类型名称映射
 */
const challengeTypeNames: Record<string, string> = {
  conquest: "征服",
  defense: "防守",
  exploration: "探索",
  social: "社交",
  daily: "每日",
}

/**
 * 格式化目标描述
 */
function formatObjectiveDescription(challenge: Challenge): string {
  const { objective, type } = challenge

  switch (objective.type) {
    case "tiles":
      return `占领 ${objective.target} 个六边形`
    case "time":
      return `连续 ${objective.target} 天`
    case "area":
      return `探索 ${objective.target} 个区域`
    case "friends":
      return `邀请 ${objective.target} 位好友`
    case "logins":
      return `登录并占领领地`
    default:
      return "完成目标"
  }
}

/**
 * 格式化奖励描述
 */
function formatRewards(rewards: Challenge["rewards"]): string {
  const parts: string[] = []
  if (rewards.experience > 0) parts.push(`${rewards.experience} XP`)
  if (rewards.points > 0) parts.push(`${rewards.points} 积分`)
  return parts.join(" + ")
}

/**
 * 计算剩余时间
 */
function calculateRemainingTime(endDate: string): { days: number; hours: number; isExpired: boolean } {
  const end = new Date(endDate)
  const now = new Date()
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) {
    return { days: 0, hours: 0, isExpired: true }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  return { days, hours, isExpired: false }
}

/**
 * 挑战卡片组件
 */
export function ChallengeCard({ challenge, progress = 0, onClick, compact = false }: ChallengeCardProps) {
  const { currentCity } = useCity()
  const [isHovered, setIsHovered] = React.useState(false)

  const Icon = challengeTypeIcons[challenge.type] || Star
  const typeName = challengeTypeNames[challenge.type] || "挑战"
  const objectiveDesc = formatObjectiveDescription(challenge)
  const rewardDesc = formatRewards(challenge.rewards)
  const { days, hours, isExpired } = calculateRemainingTime(challenge.endDate)
  const isUrgent = days === 0 && hours < 24 && !isExpired

  if (!currentCity) return null

  // 检查是否已过期
  if (isExpired) return null

  // 紧凑模式
  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200"
        style={{ borderLeft: challenge.isMainQuest ? `3px solid ${currentCity.theme.primary}` : 'none' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ background: `${currentCity.theme.primary}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: currentCity.theme.primary }} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <h4 className="text-sm font-bold text-white truncate">{challenge.name}</h4>
            <p className="text-xs text-white/60 truncate">{objectiveDesc}</p>
          </div>
          {challenge.isTimeLimited && (
            <div className={`text-xs font-medium ${isUrgent ? 'text-red-400' : 'text-white/60'}`}>
              {days > 0 && `${days}天`}
              {days === 0 && `${hours}h`}
            </div>
          )}
        </div>
      </button>
    )
  }

  // 完整模式
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`w-full p-4 rounded-2xl border backdrop-blur-xl transition-all duration-300 ${
        isHovered ? 'scale-[1.02]' : 'scale-100'
      } ${challenge.isMainQuest ? 'bg-gradient-to-br from-white/10 to-white/5 border-white/20' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
      style={challenge.isMainQuest ? { borderLeft: `4px solid ${currentCity.theme.primary}` } : {}}
    >
      {/* 头部 */}
      <div className="flex items-start gap-3 mb-3">
        {/* 图标 */}
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
            isHovered ? 'scale-110' : 'scale-100'
          }`}
          style={{ background: `${currentCity.theme.primary}25` }}
        >
          <Icon className={`w-6 h-6 transition-all duration-300 ${isHovered ? 'scale-110' : ''}`} style={{ color: currentCity.theme.primary }} />
        </div>

        {/* 标题和标签 */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-bold text-white truncate">{challenge.name}</h3>
            {challenge.isMainQuest && (
              <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 text-[10px] font-medium rounded-full"
              style={{ background: `${currentCity.theme.primary}30`, color: currentCity.theme.primary }}
            >
              {typeName}
            </span>
            {challenge.isTimeLimited && (
              <span className={`text-[10px] font-medium ${isUrgent ? 'text-red-400' : 'text-white/50'}`}>
                {days > 0 ? `剩余 ${days} 天` : `剩余 ${hours} 小时`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 描述 */}
      <p className="text-sm text-white/70 mb-3 leading-relaxed">{challenge.description}</p>

      {/* 目标 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="px-2 py-1 rounded-lg bg-white/5 border border-white/10">
          <span className="text-xs text-white/60">目标:</span>
          <span className="text-xs text-white ml-1">{objectiveDesc}</span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/60">进度</span>
          <span className="text-xs font-medium" style={{ color: currentCity.theme.primary }}>
            {progress}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})`,
            }}
          />
        </div>
      </div>

      {/* 奖励 */}
      <div className="flex items-center justify-between pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          <span className="text-xs text-white/80">{rewardDesc}</span>
        </div>
        {challenge.isTimeLimited && isUrgent && (
          <span className="px-2 py-1 text-[10px] font-bold bg-red-500/20 text-red-400 rounded animate-pulse">
            即将结束
          </span>
        )}
      </div>
    </button>
  )
}

/**
 * 挑战详情弹窗组件
 */
export function ChallengeDetailModal({ challenge, isOpen, onClose, onStart }: { challenge: Challenge; isOpen: boolean; onClose: () => void; onStart: () => void }) {
  const { currentCity } = useCity()

  if (!isOpen || !currentCity) return null

  const Icon = challengeTypeIcons[challenge.type] || Star
  const objectiveDesc = formatObjectiveDescription(challenge)
  const rewardDesc = formatRewards(challenge.rewards)
  const { days, hours } = calculateRemainingTime(challenge.endDate)

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="fixed inset-0 z-[301] flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md rounded-2xl border backdrop-blur-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300"
          style={{
            background: `linear-gradient(135deg, ${currentCity.theme.primary}15 0%, ${currentCity.theme.secondary}10 100%)`,
            borderColor: `${currentCity.theme.primary}30`,
          }}
        >
          {/* 装饰背景 */}
          <div className="absolute top-0 right-0 w-48 h-48 opacity-10">
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at center, ${currentCity.theme.primary} 0%, transparent 70%)` }} />
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-white/60 hover:text-white/80" />
          </button>

          {/* 内容 */}
          <div className="relative p-6">
            {/* 标题 */}
            <div className="flex items-start gap-4 mb-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: `${currentCity.theme.primary}25` }}
              >
                <Icon className="w-8 h-8" style={{ color: currentCity.theme.primary }} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white mb-1">{challenge.name}</h2>
                <p className="text-sm text-white/60">{challenge.description}</p>
              </div>
            </div>

            {/* 挑战类型 */}
            <div className="flex items-center gap-2 mb-4">
              <span
                className="px-3 py-1.5 text-sm font-medium rounded-xl"
                style={{ background: `${currentCity.theme.primary}30`, color: currentCity.theme.primary }}
              >
                {challengeTypeNames[challenge.type]}
              </span>
              {challenge.isMainQuest && (
                <span className="px-3 py-1.5 text-sm font-medium rounded-xl bg-yellow-500/20 text-yellow-400">
                  主线任务
                </span>
              )}
            </div>

            {/* 目标 */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
              <h3 className="text-sm font-bold text-white mb-2">任务目标</h3>
              <p className="text-base text-white/90">{objectiveDesc}</p>
            </div>

            {/* 奖励 */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
              <h3 className="text-sm font-bold text-white mb-2">任务奖励</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <span className="text-base font-bold text-white">{challenge.rewards.experience} XP</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-400" />
                  <span className="text-base font-bold text-white">{challenge.rewards.points} 积分</span>
                </div>
              </div>
            </div>

            {/* 时间限制 */}
            {challenge.isTimeLimited && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 mb-6">
                <Clock className="w-4 h-4 text-blue-400" />
                <div>
                  <p className="text-xs text-blue-400 font-medium">限时任务</p>
                  <p className="text-sm text-white/80">
                    {days > 0 ? `剩余 ${days} 天 ${hours} 小时` : `剩余 ${hours} 小时`}
                  </p>
                </div>
              </div>
            )}

            {/* 按钮 */}
            <button
              onClick={() => {
                onStart()
                onClose()
              }}
              className="w-full py-3 rounded-xl font-bold text-white transition-all duration-200 hover:scale-105 active:scale-95"
              style={{ background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})` }}
            >
              开始挑战
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * 挑战列表组件
 */
export function ChallengeList({ challenges, onSelect }: { challenges: Challenge[]; onSelect: (challenge: Challenge) => void }) {
  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Lock className="w-12 h-12 text-white/20 mb-3" />
        <p className="text-sm text-white/60">暂无可用挑战</p>
      </div>
    )
  }

  // 按优先级排序
  const sortedChallenges = [...challenges].sort((a, b) => b.priority - a.priority)

  return (
    <div className="space-y-3">
      {sortedChallenges.map((challenge) => (
        <ChallengeCard
          key={challenge.id}
          challenge={challenge}
          progress={Math.random() * 100}
          onClick={() => onSelect(challenge)}
        />
      ))}
    </div>
  )
}
