"use client"

import React, { useState, useEffect } from "react"
import { useCity } from "@/contexts/CityContext";
import { useRegion } from "@/contexts/RegionContext";
import { useGameStore } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration";
import { ChevronDown, Calendar, Activity, MapPin, Navigation, User, Zap, Palette, Trophy } from "lucide-react"
import { CityDrawer } from "./CityDrawer"
import { LoadingSpinner } from "@/components/citylord/loading-screen"

/**
 * 跑步实时数据类型
 */
interface RunningStats {
  isRunning: boolean
  distance: number // 米
  pace: number // 秒/公里
  duration: number // 秒
}

/**
 * 格式化配速显示
 */
function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60)
  const seconds = paceSeconds % 60
  return `${minutes}'${seconds.toString().padStart(2, "0")}"`
}

/**
 * 格式化距离显示
 */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`
  }
  return `${(meters / 1000).toFixed(2)}km`
}

/**
 * 格式化时长显示
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`
}

import { GlassCard } from "@/components/ui/GlassCard"

/**
 * 地图头部状态栏组件
 * Displays user stats, city info, and GPS status
 */
export function MapHeader({ isCityDrawerOpen, setIsCityDrawerOpen, setShowThemeSwitcher }: { isCityDrawerOpen: boolean, setIsCityDrawerOpen: (isOpen: boolean) => void, setShowThemeSwitcher: (isOpen: boolean) => void }) {
  const { region } = useRegion();
  const { currentCity, isLoading, leaderboard, currentCityProgress, totalPlayers } = useCity();


  const { gpsStatus, level, currentExp, maxExp, stamina, maxStamina, lastStaminaUpdate } = useGameStore();
  const hydrated = useHydration();

  // GPS Status Config
  const getGpsStatusConfig = () => {
    switch(gpsStatus) {
      case 'success': return { icon: Navigation, color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'GPS正常' }
      case 'locating': return { icon: Navigation, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: '定位中' }
      case 'error': return { icon: Navigation, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'GPS异常' }
      default: return { icon: Navigation, color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: '无信号' }
    }
  }
  const gpsConfig = getGpsStatusConfig()
  const GpsIcon = gpsConfig.icon
  const expProgress = Math.min(100, Math.max(0, (currentExp / maxExp) * 100))

  // 计算体力恢复倒计时
  const [timeToNext, setTimeToNext] = useState<string | null>(null)

  useEffect(() => {
    const updateTimeToNext = () => {
      if (stamina >= maxStamina) {
        setTimeToNext(null)
        return
      }

      const now = Date.now()
      const timeDiff = now - lastStaminaUpdate
      const recoveryInterval = 3 * 60 * 1000 // 3 minutes
      const timeToNextRecovery = recoveryInterval - (timeDiff % recoveryInterval)
      
      const minutes = Math.floor(timeToNextRecovery / 60000)
      const seconds = Math.floor((timeToNextRecovery % 60000) / 1000)
      
      setTimeToNext(`+${minutes}:${seconds.toString().padStart(2, '0')}`)
    }

    updateTimeToNext()
    const interval = setInterval(updateTimeToNext, 1000)
    
    return () => clearInterval(interval)
  }, [stamina, maxStamina, lastStaminaUpdate])

  if (!currentCity || isLoading || !hydrated) {
    return (
      <div className="absolute top-6 left-4 right-4 z-[100]">
        <GlassCard className="flex items-center justify-center py-3">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-sm text-white/80">
            {isLoading || !hydrated ? "加载中..." : "请选择城市"}
          </span>
        </GlassCard>
      </div>
    )
  }

  return (
    <>
      {/* 头部状态栏容器 - 固定在顶部 */}
      <div className="absolute top-[env(safe-area-inset-top)] left-0 right-0 z-[50] px-4">
        <GlassCard className="p-1">
          <div className="flex items-center justify-between gap-2">
            {/* 左侧：城市选择器 */}
            <button
              onClick={() => setIsCityDrawerOpen(true)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className="text-xl">{currentCity.icon}</span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-white">{region?.countyName || region?.cityName || currentCity.name}</span>
                <ChevronDown className="w-3 h-3 text-white/40" />
              </div>
            </button>

            {/* 中间：用户等级进度与体力 */}
            <div className="flex-1 px-2 border-l border-r border-white/5 mx-1 flex flex-col gap-2">
              {/* Level & EXP */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-white/80 flex items-center gap-1">
                    <User className="w-3 h-3" /> Lv.{level}
                  </span>
                  <span className="text-[10px] text-white/40">
                    {currentExp}/{maxExp}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${expProgress}%`,
                      background: `linear-gradient(90deg, ${currentCity.theme.primary}, ${currentCity.theme.secondary})`,
                    }}
                  />
                </div>
              </div>

              {/* Stamina */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] font-medium text-cyan-400 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> 体力
                  </span>
                  <span className="text-[10px] text-cyan-400/60">
                    {stamina}/{maxStamina} {timeToNext && <span className="text-[8px] ml-1">({timeToNext})</span>}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-cyan-950/50 overflow-hidden border border-cyan-500/20">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                    style={{
                      width: `${(stamina / maxStamina) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* City Ranking */}
              {currentCityProgress && (
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
                      <Trophy className="w-3 h-3" />
                      {currentCity.name}排名
                    </span>
                    <span className="text-[10px] text-amber-400/60">
                      第 {currentCityProgress.ranking} 名
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-amber-950/50 overflow-hidden border border-amber-500/20">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                      style={{
                        width: `${(1 - currentCityProgress.ranking / totalPlayers) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 右侧：GPS 状态 */}
            <div className="flex items-center gap-1 pr-2">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${gpsConfig.bg} ${gpsConfig.border}`}>
                  <GpsIcon className={`w-3 h-3 ${gpsConfig.color} ${gpsStatus === 'locating' ? 'animate-spin' : ''}`} />
                  <span className={`text-[10px] font-bold ${gpsConfig.color}`}>{gpsConfig.text}</span>
              </div>
              <button
                onClick={() => setShowThemeSwitcher(true)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <Palette className="w-4 h-4 text-white/80" />
              </button>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 城市切换抽屉 */}
      <CityDrawer isOpen={isCityDrawerOpen} onClose={() => setIsCityDrawerOpen(false)} />
    </>
  )
}
