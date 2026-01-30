"use client"

import React, { useState } from "react"
import type { Achievement } from "@/types/city"
import { useCity } from "@/contexts/CityContext"
import { Lock, Check, Star, Trophy, Medal, Award, Crown, Diamond } from "lucide-react"

/**
 * 成就画廊组件
 */
export function AchievementGallery({ achievements, onUnlock }: { achievements: Achievement[]; onUnlock?: (achievement: Achievement) => void }) {
  const { currentCity } = useCity()
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null)
  const [filter, setFilter] = useState<"all" | "locked" | "completed">("all")

  if (!currentCity) return null

  // 过滤成就
  const filteredAchievements = achievements.filter((ach) => {
    if (filter === "locked") return !ach.isCompleted
    if (filter === "completed") return ach.isCompleted
    return true
  })

  // 获取成就等级样式
  const getTierStyle = (tier: Achievement["tier"]) => {
    const styles: Record<Achievement["tier"], { bg: string; border: string; text: string; icon: React.ElementType }> = {
      bronze: {
        bg: "from-orange-500/20 to-amber-600/10",
        border: "border-orange-500/30",
        text: "text-orange-400",
        icon: Medal,
      },
      silver: {
        bg: "from-gray-400/20 to-slate-500/10",
        border: "border-gray-400/30",
        text: "text-gray-300",
        icon: Award,
      },
      gold: {
        bg: "from-yellow-500/20 to-amber-500/10",
        border: "border-yellow-500/30",
        text: "text-yellow-400",
        icon: Trophy,
      },
      platinum: {
        bg: "from-cyan-400/20 to-blue-500/10",
        border: "border-cyan-400/30",
        text: "text-cyan-400",
        icon: Crown,
      },
      diamond: {
        bg: "from-purple-500/20 to-pink-500/10",
        border: "border-purple-500/30",
        text: "text-purple-400",
        icon: Diamond,
      },
    }
    return styles[tier]
  }

  // 获取成就状态样式
  const getStatusStyle = (achievement: Achievement) => {
    if (achievement.isCompleted) {
      return {
        status: "completed",
        bg: `${currentCity.theme.primary}20`,
        border: `${currentCity.theme.primary}50`,
        opacity: 1,
        isGlowing: true,
      }
    }

    // 模拟可领取状态（进度接近完成）
    const progress = achievement.progress ? achievement.progress.current / achievement.progress.max : 0
    if (progress >= 0.8) {
      return {
        status: "claimable",
        bg: "from-green-500/20 to-emerald-500/10",
        border: "border-green-500/50",
        opacity: 1,
        isGlowing: true,
      }
    }

    return {
      status: "locked",
      bg: "from-white/5 to-white/[0.02]",
      border: "border-white/10",
      opacity: 0.5,
      isGlowing: false,
    }
  }

  const tierStats = achievements.reduce((acc, ach) => {
    if (ach.isCompleted) {
      acc[ach.tier] = (acc[ach.tier] || 0) + 1
    }
    return acc
  }, {} as Record<string, number>)

  const completedCount = achievements.filter((ach) => ach.isCompleted).length

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <div className="p-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">成就统计</h2>
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-white/80">
              {completedCount} / {achievements.length}
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="mb-4">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(completedCount / achievements.length) * 100}%`,
                background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})`,
              }}
            />
          </div>
        </div>

        {/* 等级统计 */}
        <div className="grid grid-cols-5 gap-2">
          {(["bronze", "silver", "gold", "platinum", "diamond"] as Achievement["tier"][]).map((tier) => {
            const style = getTierStyle(tier)
            const count = tierStats[tier] || 0
            return (
              <div key={tier} className="text-center p-2 rounded-lg bg-white/5 border border-white/10">
                <style.icon className={`w-4 h-4 mx-auto mb-1 ${style.text}`} />
                <p className="text-xs font-bold text-white">{count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
        {[
          { value: "all" as const, label: "全部" },
          { value: "locked" as const, label: "未解锁" },
          { value: "completed" as const, label: "已达成" },
        ].map((filterOption) => (
          <button
            key={filterOption.value}
            onClick={() => setFilter(filterOption.value)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
              filter === filterOption.value
                ? "text-white"
                : "text-white/60 hover:text-white/80"
            } ${
              filter === filterOption.value
                ? `bg-gradient-to-r ${currentCity.theme.primary}20`
                : "hover:bg-white/5"
            }`}
          >
            {filterOption.label}
          </button>
        ))}
      </div>

      {/* 成就网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredAchievements.map((achievement) => {
          const tierStyle = getTierStyle(achievement.tier)
          const statusStyle = getStatusStyle(achievement)
          const TierIcon = tierStyle.icon
          const progress = achievement.progress ? achievement.progress.current / achievement.progress.max : 0

          return (
            <button
              key={achievement.id}
              onClick={() => setSelectedAchievement(achievement)}
              className={`relative p-4 rounded-xl border transition-all duration-300 ${
                statusStyle.isGlowing ? "animate-pulse hover:scale-105" : "hover:scale-105 hover:border-white/30"
              }`}
              style={{
                background: statusStyle.bg,
                borderColor: statusStyle.border,
                opacity: statusStyle.opacity,
              }}
            >
              {/* 等级图标 */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2">
                {achievement.isCompleted ? (
                  <TierIcon className={`w-6 h-6 ${tierStyle.text}`} />
                ) : (
                  <Lock className={`w-6 h-6 text-white/40`} />
                )}
              </div>

              {/* 成就图标 */}
              <div className="text-3xl mb-2">{achievement.icon || "🏆"}</div>

              {/* 成就名称 */}
              <h3 className="text-sm font-bold text-white mb-1 truncate">{achievement.name}</h3>

              {/* 进度条（未完成时显示） */}
              {!achievement.isCompleted && progress > 0 && (
                <div className="mt-2">
                  <div className="h-1 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/50 mt-1">
                    {progress * 100}%
                  </p>
                </div>
              )}

              {/* 完成标记 */}
              {achievement.isCompleted && (
                <div
                  className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: currentCity.theme.primary }}
                >
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 成就详情弹窗 */}
      {selectedAchievement && (
        <AchievementDetailModal achievement={selectedAchievement} onClose={() => setSelectedAchievement(null)} />
      )}
    </div>
  )
}

/**
 * 成就详情弹窗
 */
function AchievementDetailModal({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  const { currentCity } = useCity()

  const getTierStyle = (tier: Achievement["tier"]) => {
    const styles: Record<Achievement["tier"], { bg: string; border: string; text: string; icon: React.ElementType; name: string }> = {
      bronze: {
        bg: "from-orange-500/20 to-amber-600/10",
        border: "border-orange-500/30",
        text: "text-orange-400",
        icon: Medal,
        name: "青铜",
      },
      silver: {
        bg: "from-gray-400/20 to-slate-500/10",
        border: "border-gray-400/30",
        text: "text-gray-300",
        icon: Award,
        name: "白银",
      },
      gold: {
        bg: "from-yellow-500/20 to-amber-500/10",
        border: "border-yellow-500/30",
        text: "text-yellow-400",
        icon: Trophy,
        name: "黄金",
      },
      platinum: {
        bg: "from-cyan-400/20 to-blue-500/10",
        border: "border-cyan-400/30",
        text: "text-cyan-400",
        icon: Crown,
        name: "铂金",
      },
      diamond: {
        bg: "from-purple-500/20 to-pink-500/10",
        border: "border-purple-500/30",
        text: "text-purple-400",
        icon: Diamond,
        name: "钻石",
      },
    }
    return styles[tier]
  }

  if (!currentCity) return null

  const tierStyle = getTierStyle(achievement.tier)
  const TierIcon = tierStyle.icon
  const progress = achievement.progress ? achievement.progress.current / achievement.progress.max : 0

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
            background: achievement.isCompleted
              ? `linear-gradient(135deg, ${currentCity.theme.primary}15 0%, ${currentCity.theme.secondary}10 100%)`
              : "from-white/10 to-white/5",
            borderColor: achievement.isCompleted ? `${currentCity.theme.primary}30` : "rgba(255,255,255,0.1)",
          }}
        >
          {/* 装饰背景 */}
          <div className="absolute top-0 right-0 w-48 h-48 opacity-10">
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at center, ${achievement.isCompleted ? currentCity.theme.primary : '#ffffff'} 0%, transparent 70%)`,
              }}
            />
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
          >
            <Lock className="w-5 h-5 text-white/60 hover:text-white/80" />
          </button>

          {/* 内容 */}
          <div className="relative p-6">
            {/* 等级和图标 */}
            <div className="flex items-center justify-center mb-4">
              <div
                className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center border-2 ${
                  achievement.isCompleted ? "animate-pulse" : ""
                }`}
                style={{
                  background: `linear-gradient(135deg, ${tierStyle.bg})`,
                  borderColor: achievement.isCompleted ? currentCity.theme.primary : tierStyle.border,
                }}
              >
                {achievement.isCompleted ? (
                  <TierIcon className={`w-12 h-12 mb-2 ${tierStyle.text}`} />
                ) : (
                  <Lock className="w-12 h-12 text-white/40" />
                )}
                <div className="text-4xl">{achievement.icon}</div>
              </div>
            </div>

            {/* 标题 */}
            <h2 className="text-2xl font-bold text-white text-center mb-2">{achievement.name}</h2>
            <p className="text-sm text-white/60 text-center mb-4">{achievement.description}</p>

            {/* 等级标签 */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <span
                className="px-3 py-1.5 text-sm font-medium rounded-xl"
                style={{ background: `${tierStyle.bg}`, color: tierStyle.text, border: tierStyle.border }}
              >
                {tierStyle.name}
              </span>
              {achievement.isCompleted && (
                <span className="px-3 py-1.5 text-sm font-medium rounded-xl bg-green-500/20 text-green-400">
                  已解锁
                </span>
              )}
            </div>

            {/* 完成条件 */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
              <h3 className="text-sm font-bold text-white mb-2">解锁条件</h3>
              <p className="text-sm text-white/80">
                {achievement.conditions.type === "tiles_captured" && `占领 ${achievement.conditions.threshold} 个六边形`}
                {achievement.conditions.type === "area_controlled" && `控制 ${achievement.conditions.threshold} 平方公里面积`}
                {achievement.conditions.type === "cities_visited" && `访问 ${achievement.conditions.threshold} 个不同城市`}
                {achievement.conditions.type === "friends_count" && `添加 ${achievement.conditions.threshold} 位好友`}
                {achievement.conditions.type === "consecutive_days" && `连续登录 ${achievement.conditions.threshold} 天`}
              </p>
            </div>

            {/* 进度（未完成时） */}
            {!achievement.isCompleted && progress > 0 && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">进度</span>
                  <span className="text-sm text-white/80">
                    {achievement.progress?.current || 0} / {achievement.conditions.threshold}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* 奖励 */}
            {achievement.isCompleted && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                <h3 className="text-sm font-bold text-white mb-2">奖励</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-white">{achievement.rewards.experience} XP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-purple-400" />
                    <span className="text-sm text-white">{achievement.rewards.points} 积分</span>
                  </div>
                </div>
              </div>
            )}

            {/* 完成时间 */}
            {achievement.isCompleted && achievement.completedAt && (
              <div className="text-center">
                <p className="text-xs text-white/50">解锁于 {achievement.completedAt}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
