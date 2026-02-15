"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { Swords, TrendingUp, Shield, Crown, Award, ChevronRight } from "lucide-react"
import { useCity } from "@/contexts/CityContext"

export interface FriendChallenge {
  id: string
  userId: string
  userName: string
  userAvatar: string
  userLevel: number
  totalTiles: number
  winRate: number
  challengeType: "conquest" | "defense" | "speed"
  challengeText: string
  difficulty: "easy" | "medium" | "hard"
  timeRemaining: string
  isOnline: boolean
}

export interface FriendChallengeCardProps {
  challenge: FriendChallenge
  onAccept: (challengeId: string) => void
  onReject: (challengeId: string) => void
  onViewProfile?: (userId: string) => void
  compact?: boolean
}

const mockFriends: FriendChallenge[] = [
  {
    id: "challenge-1",
    userId: "friend1",
    userName: "跑步达人",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=runner1",
    userLevel: 25,
    totalTiles: 1250,
    winRate: 78,
    challengeType: "conquest",
    challengeText: "挑战你争夺奥林匹克公园的控制权",
    difficulty: "medium",
    timeRemaining: "23:59",
    isOnline: true,
  },
  {
    id: "challenge-2",
    userId: "friend2",
    userName: "夜跑之王",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=nightrunner2",
    userLevel: 32,
    totalTiles: 1890,
    winRate: 85,
    challengeType: "defense",
    challengeText: "发起防守挑战，保护你的领土",
    difficulty: "hard",
    timeRemaining: "45:30",
    isOnline: true,
  },
  {
    id: "challenge-3",
    userId: "friend3",
    userName: "城市探险家",
    userAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=explorer3",
    userLevel: 18,
    totalTiles: 780,
    winRate: 65,
    challengeType: "speed",
    challengeText: "竞速挑战：谁先占领10个六边形",
    difficulty: "easy",
    timeRemaining: "10:00",
    isOnline: false,
  },
]

export function FriendChallengeCard({
  challenge,
  onAccept,
  onReject,
  onViewProfile,
  compact = false,
}: FriendChallengeCardProps) {
  const { currentCity } = useCity()
  const fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(challenge.userName || 'user')}`
  const [avatarSrc, setAvatarSrc] = useState(challenge.userAvatar)

  useEffect(() => {
    setAvatarSrc(challenge.userAvatar)
  }, [challenge.userAvatar])

  const getChallengeIcon = (type: FriendChallenge["challengeType"]) => {
    switch (type) {
      case "conquest":
        return <Swords className="h-4 w-4" />
      case "defense":
        return <Shield className="h-4 w-4" />
      case "speed":
        return <TrendingUp className="h-4 w-4" />
    }
  }

  const getDifficultyColor = (difficulty: FriendChallenge["difficulty"]) => {
    switch (difficulty) {
      case "easy":
        return "from-green-500/20 to-emerald-500/10 border-green-500/30"
      case "medium":
        return "from-yellow-500/20 to-orange-500/10 border-yellow-500/30"
      case "hard":
        return "from-red-500/20 to-rose-500/10 border-red-500/30"
    }
  }

  const getDifficultyText = (difficulty: FriendChallenge["difficulty"]) => {
    switch (difficulty) {
      case "easy":
        return "简单"
      case "medium":
        return "中等"
      case "hard":
        return "困难"
    }
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-black/60 to-black/40 backdrop-blur-xl border border-white/10 transition-all duration-300 hover:scale-[1.02] hover:border-white/20 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {/* 难度标签 */}
      <div
        className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md border bg-gradient-to-r ${getDifficultyColor(challenge.difficulty)}`}
      >
        {getDifficultyText(challenge.difficulty)}
      </div>

      {/* 内容 */}
      <div className={`flex items-start gap-3 ${compact ? "" : "mt-1"}`}>
        {/* 头像 */}
        <div className="relative flex-shrink-0">
          <Image
            src={avatarSrc}
            alt={challenge.userName}
            width={compact ? 40 : 48}
            height={compact ? 40 : 48}
            unoptimized
            className={`rounded-full border-2 ${compact ? "h-10 w-10" : "h-12 w-12"}`}
            style={{
              borderColor: currentCity?.themeColors.primary,
            }}
            onError={() => {
              if (avatarSrc !== fallbackAvatar) {
                setAvatarSrc(fallbackAvatar)
              }
            }}
          />
          {/* 在线状态 */}
          {challenge.isOnline && (
            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-black" />
          )}
          {/* 等级 */}
          <div
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${currentCity?.themeColors.primary}, ${currentCity?.themeColors.secondary})`,
            }}
          >
            {challenge.userLevel}
          </div>
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          {/* 名称和类型 */}
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{challenge.userName}</p>
            <div
              className="rounded-full p-1"
              style={{
                backgroundColor: `${currentCity?.themeColors.primary}30`,
              }}
            >
              {getChallengeIcon(challenge.challengeType)}
            </div>
          </div>

          {/* 挑战描述 */}
          <p className={`mt-1 text-xs text-white/70 ${compact ? "line-clamp-1" : ""}`}>
            {challenge.challengeText}
          </p>

          {/* 统计信息 */}
          {!compact && (
            <div className="mt-2 flex items-center gap-4 text-[10px] text-white/50">
              <div className="flex items-center gap-1">
                <Award className="h-3 w-3" />
                <span>{challenge.totalTiles}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                <span>{challenge.winRate}% 胜率</span>
              </div>
              <div className="flex items-center gap-1">
                <Crown className="h-3 w-3" />
                <span>{challenge.timeRemaining}</span>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {!compact && (
          <div className="flex gap-2">
            <button
              onClick={() => onReject(challenge.id)}
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/20 transition-colors"
            >
              拒绝
            </button>
            <button
              onClick={() => onAccept(challenge.id)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r px-3 py-2 text-xs font-medium text-white hover:opacity-90 transition-opacity"
              style={{
                background: `linear-gradient(135deg, ${currentCity?.themeColors.primary}, ${currentCity?.themeColors.secondary})`,
              }}
            >
              接受
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* 紧凑模式：仅显示接受按钮 */}
      {compact && (
        <button
          onClick={() => onAccept(challenge.id)}
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
          style={{
            backgroundColor: `${currentCity?.themeColors.primary}40`,
          }}
        >
          接受挑战
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export function FriendChallengeList({
  challenges = mockFriends,
  onAccept,
  onReject,
  onViewProfile,
  maxDisplay = 3,
  compact = false,
}: {
  challenges?: FriendChallenge[]
  onAccept: (challengeId: string) => void
  onReject: (challengeId: string) => void
  onViewProfile?: (userId: string) => void
  maxDisplay?: number
  compact?: boolean
}) {
  const displayChallenges = challenges.slice(0, maxDisplay)

  return (
    <div className="space-y-3">
      {displayChallenges.map((challenge) => (
        <FriendChallengeCard
          key={challenge.id}
          challenge={challenge}
          onAccept={onAccept}
          onReject={onReject}
          onViewProfile={onViewProfile}
          compact={compact}
        />
      ))}
      {challenges.length > maxDisplay && (
        <button className="w-full rounded-xl bg-white/5 py-2 text-xs text-white/50 hover:bg-white/10 transition-colors">
          查看更多挑战 ({challenges.length - maxDisplay})
        </button>
      )}
    </div>
  )
}
