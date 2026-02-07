"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useCity } from "@/contexts/CityContext";
import { useRegion } from "@/contexts/RegionContext";
import { useGameStore } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration";
import { ChevronDown, Calendar, Activity, MapPin, Navigation, User, Zap, Palette, Trophy, LogIn, X, Check } from "lucide-react"
import { CityDrawer } from "./CityDrawer"
import { RoomSelector } from '@/components/room/RoomSelector'
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
import { Button } from "@/components/ui/button"

function LoginModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm">
        <GlassCard className="p-6 flex flex-col items-center gap-4 border border-[#22c55e]/30 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
          <button 
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>
          
          <div className="w-16 h-16 rounded-full bg-[#22c55e]/20 flex items-center justify-center mb-2">
            <LogIn className="w-8 h-8 text-[#22c55e]" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white">欢迎加入 City Lord</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              登录账号以保存您的领地探索进度、<br/>
              积累成就并与好友一较高下！
            </p>
          </div>

          <Link href="/login" className="w-full mt-2">
            <Button className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold h-11 rounded-xl shadow-lg shadow-green-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
              立即登录 / 注册
            </Button>
          </Link>
          
          <button 
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white/60 transition-colors mt-2"
          >
            暂不登录，以游客身份试玩
          </button>
        </GlassCard>
      </div>
    </div>
  )
}

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from "sonner";

/**
 * 地图头部状态栏组件
 * Displays user stats, city info, and GPS status
 */
export function MapHeader({ isCityDrawerOpen, setIsCityDrawerOpen, setShowThemeSwitcher }: { isCityDrawerOpen: boolean, setIsCityDrawerOpen: (isOpen: boolean) => void, setShowThemeSwitcher: (isOpen: boolean) => void }) {
  const { region } = useRegion();
  const { currentCity, isLoading, leaderboard, currentCityProgress, totalPlayers } = useCity();


  const { gpsStatus, level, currentExp, maxExp, stamina, maxStamina, lastStaminaUpdate } = useGameStore();
  const hydrated = useHydration();

  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const supabase = createClient()
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        
        const hasSession = !!session
        setIsLoggedIn(hasSession)
        if (!hasSession) {
          // 延迟一点显示弹窗，避免加载时的闪烁
          setTimeout(() => setShowLoginModal(true), 500)
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError' && e?.digest !== 'NEXT_REDIRECT') {
            console.error("Failed to check session", e)
        }
      }
    }
    checkUser()
  }, [])

  const [requestingLocation, setRequestingLocation] = useState(false);

  // GPS Status Config
  const getGpsStatusConfig = () => {
    if (requestingLocation) return { icon: Navigation, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: '请求中' };

    switch(gpsStatus) {
      case 'success': return { icon: Check, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/20', border: 'border-[#22c55e]/50', text: '已定位' }
      case 'locating': return { icon: Navigation, color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: '定位中' }
      case 'error': return { icon: Navigation, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'GPS异常' }
      default: return { icon: Navigation, color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: '无信号' }
    }
  }
  const gpsConfig = getGpsStatusConfig()
  const GpsIcon = gpsConfig.icon

  const handleGPSClick = async () => {
    // 允许重试，但防止连点
    if (requestingLocation) return;
    
    setRequestingLocation(true);
    try {
        if (!Capacitor.isNativePlatform()) {
             toast.info("网页端请允许浏览器定位权限");
             window.location.reload();
             return;
        }

        // Native Permission Flow
        const status = await Geolocation.requestPermissions();
        
        if (status.location === 'denied' || status.coarseLocation === 'denied') {
             toast.error("定位权限被拒绝", {
               description: "请前往系统设置中手动开启定位权限"
             });
        } else if (status.location === 'granted' || status.coarseLocation === 'granted') {
             toast.success("授权成功，正在定位...");
             // 重载页面以触发 useGeolocation 的初始化
             window.location.reload();
        } else {
             toast.warning("请允许定位权限以继续");
        }
    } catch (e) {
        console.error("GPS Permission Error", e);
        toast.error("请求权限失败", { description: "请检查设备设置" });
    } finally {
        // 务必重置状态，否则 UI 会一直转圈
        setRequestingLocation(false);
    }
  };

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
      {/* 头部状态栏容器 - 固定在顶部安全区域 */}
      <div className="absolute top-0 left-0 right-0 z-[100] px-4 transition-all duration-300 pt-[calc(env(safe-area-inset-top)+1rem)]">
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
            <div className={`flex-1 px-2 border-l border-r border-white/5 mx-1 flex flex-col ${!isLoggedIn ? 'justify-center items-center opacity-0' : 'gap-2'}`}>
              {!isLoggedIn ? (
                null
              ) : (
                <>
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
              </>
              )}
            </div>

            {/* 右侧：GPS 状态 */}
            <div className="flex items-center gap-1 pr-2">
              {/* RoomSelector hidden as per user request - moved to bottom navigation */}
              {/* <RoomSelector className="h-8 border-none bg-transparent hover:bg-white/5" compact /> */}
              <button 
                onClick={handleGPSClick}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${gpsConfig.bg} ${gpsConfig.border} transition-all active:scale-95`}
              >
                  <GpsIcon className={`w-3 h-3 ${gpsConfig.color} ${gpsStatus === 'locating' || requestingLocation ? 'animate-spin' : ''}`} />
                  <span className={`text-[10px] font-bold ${gpsConfig.color}`}>{gpsConfig.text}</span>
              </button>
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

      {/* 登录提示弹窗 */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}
