"use client"

import React from "react"
import { useCity } from "@/contexts/CityContext"
import { MapPin, Users, Calendar, TrendingUp } from "lucide-react"

/**
 * 城市信息展示组件
 * 显示当前城市的详细信息
 */
export function CityInfo() {
  const { currentCity, currentCityProgress, isLoading } = useCity()

  if (isLoading) {
    return (
      <div className="w-full h-32 rounded-xl border border-white/10 bg-white/5 animate-pulse" />
    )
  }

  if (!currentCity) {
    return null
  }

  const captureRate = (currentCity.stats.capturedTiles / currentCity.stats.totalTiles) * 100
  const activeRate = (currentCity.stats.activePlayers / currentCity.stats.totalPlayers) * 100

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl overflow-hidden">
      {/* 城市头部 */}
      <div
        className="relative px-5 py-4 border-b border-white/10"
        style={{
          background: `linear-gradient(135deg, ${currentCity.theme.primary}20 0%, ${currentCity.theme.secondary}10 100%)`,
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{currentCity.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-white">{currentCity.name}</h2>
              {currentCity.description && (
                <p className="text-sm text-white/60 mt-0.5">{currentCity.description}</p>
              )}
            </div>
          </div>

          {/* 赛季标签 */}
          {currentCity.seasonStatus.isActive && (
            <div className="px-3 py-1.5 rounded-lg border border-white/20 bg-white/10">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-white/70" />
                <span className="text-xs font-medium text-white">
                  赛季 {currentCity.seasonStatus.currentSeason}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 城市统计数据 */}
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 总参与玩家 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-white/50" />
              <span className="text-xs text-white/50">总参与玩家</span>
            </div>
            <p className="text-xl font-bold text-white">
              {currentCity.stats.totalPlayers.toLocaleString()}
            </p>
          </div>

          {/* 活跃玩家 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-white/50">活跃玩家</span>
            </div>
            <p className="text-xl font-bold text-green-400">
              {currentCity.stats.activePlayers.toLocaleString()}
              <span className="text-xs text-green-400/60 ml-1">({activeRate.toFixed(1)}%)</span>
            </p>
          </div>

          {/* 六边形总数 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-white/50" />
              <span className="text-xs text-white/50">六边形总数</span>
            </div>
            <p className="text-xl font-bold text-white">
              {currentCity.stats.totalTiles.toLocaleString()}
            </p>
          </div>

          {/* 已占领比例 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-white/50" />
              <span className="text-xs text-white/50">已占领</span>
            </div>
            <p className="text-xl font-bold" style={{ color: currentCity.theme.primary }}>
              {captureRate.toFixed(1)}%
              <span className="text-xs text-white/60 ml-1">
                ({currentCity.stats.capturedTiles.toLocaleString()})
              </span>
            </p>
          </div>
        </div>

        {/* 占领进度条 */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-white/50">城市占领进度</span>
            <span className="text-xs font-medium" style={{ color: currentCity.theme.primary }}>
              {captureRate.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${captureRate}%`,
                background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})`,
              }}
            />
          </div>
        </div>

        {/* 用户进度 */}
        {currentCityProgress && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/50">我的进度</span>
              <span className="text-xs font-medium text-white">
                排名 #{currentCityProgress.ranking.toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-sm font-bold text-white">{currentCityProgress.level}</p>
                <p className="text-xs text-white/50">等级</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-sm font-bold" style={{ color: currentCity.theme.primary }}>
                  {currentCityProgress.tilesCaptured}
                </p>
                <p className="text-xs text-white/50">占领六边形</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/5">
                <p className="text-sm font-bold" style={{ color: currentCity.theme.primary }}>
                  {currentCityProgress.areaControlled.toFixed(2)}
                </p>
                <p className="text-xs text-white/50">面积 (km²)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
