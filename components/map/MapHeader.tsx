"use client"

import React, { useState, useEffect } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useCity } from "@/contexts/CityContext";
import { useRegion } from "@/contexts/RegionContext";
import { useGameStore, useGameActions } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration";
import { ChevronDown, Calendar, Activity, MapPin, Navigation, User, Zap, Trophy, LogIn, X, Check, Users, Signal } from "lucide-react"
import { CityDrawer } from "./CityDrawer"
import { RoomSelector } from '@/components/room/RoomSelector'
import { LoadingSpinner } from "@/components/citylord/loading-screen"

export interface MapHeaderProps {
  // Toggle for theme switcher
  setShowThemeSwitcher: (show: boolean) => void
  viewMode?: 'user' | 'club'
  onViewModeChange?: (mode: 'user' | 'club') => void
}

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
        <GlassCard className="p-6 flex flex-col items-center gap-4 border border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-white/60" />
          </button>

          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-2">
            <LogIn className="w-8 h-8 text-primary" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white">欢迎加入 City Lord</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              登录账号以保存您的领地探索进度、<br />
              积累成就并与好友一较高下！
            </p>
          </div>

          <Link href="/login" className="w-full mt-2">
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 rounded-xl shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
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

import { toast } from "sonner";
import { isNativePlatform, safeRequestGeolocationPermission } from "@/lib/capacitor/safe-plugins";


/**
 * 地图头部状态栏组件
 * Displays user stats, city info, and GPS status
 */
export function MapHeader({
  setShowThemeSwitcher,
  viewMode = 'user',
  onViewModeChange
}: MapHeaderProps) {
  const { region } = useRegion();
  const { currentCity, isLoading, leaderboard, currentCityProgress, totalPlayers } = useCity();


  const { gpsStatus, level, currentExp, maxExp, stamina, maxStamina, lastStaminaUpdate, activeDrawer, latitude, longitude, lastKnownLocation } = useGameStore();
  const { openDrawer, closeDrawer } = useGameActions();
  const hydrated = useHydration();

  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [showLoginModal, setShowLoginModal] = useState(false)
  // Start as null (SSR-safe). Populated from localStorage in useEffect (client-only).
  const [currentDistrict, setCurrentDistrict] = useState<string | null>(null)

  // Hydration-safe: read cached district name immediately after mount (client-only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem('last_known_district');
      if (cached) setCurrentDistrict(cached);
    } catch (e) {
      // Ignore storage errors, graceful degradation
    }
  }, []);

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

  // Reverse Geocoding: Convert lat/lng to district name, with localStorage caching
  useEffect(() => {
    // Only run if we have valid coordinates and AMap is loaded
    if (!latitude || !longitude || latitude === 0 || longitude === 0) return;
    if (typeof window === 'undefined' || !window.AMap) return;

    // Load Geocoder plugin
    window.AMap.plugin('AMap.Geocoder', () => {
      const geocoder = new window.AMap.Geocoder();

      geocoder.getAddress([longitude, latitude], (status: string, result: any) => {
        if (status === 'complete' && result.info === 'OK') {
          const addressComponent = result.regeocode?.addressComponent;
          if (addressComponent) {
            // Priority: District (区/县) > City > Province
            const districtName = addressComponent.district || addressComponent.city || addressComponent.province || '未知区域';

            // Only update UI + cache if value actually changed (prevents flicker)
            setCurrentDistrict(prev => {
              if (prev !== districtName) {
                try {
                  localStorage.setItem('last_known_district', districtName);
                } catch (e) { /* ignore storage errors */ }
                return districtName;
              }
              return prev; // Same value — silent, no re-render
            });
          } else {
            setCurrentDistrict(prev => prev ?? '未知位置');
          }
        } else {
          // Fallback: don't stay stuck on "定位中", but keep cached value if available
          setCurrentDistrict(prev => prev ?? '未知位置');
        }
      });
    });
  }, [latitude, longitude]);

  const [requestingLocation, setRequestingLocation] = useState(false);

  // GPS Status Config
  const getGpsStatusConfig = () => {
    if (requestingLocation) return { icon: Navigation, color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: '请求中' };

    // 只要有坐标，就视为定位成功 (As long as we have coordinates, show success)
    const hasLocation = (latitude !== null && longitude !== null && latitude !== 0 && longitude !== 0) ||
      (lastKnownLocation && lastKnownLocation.lat !== 0 && lastKnownLocation.lng !== 0) ||
      (gpsStatus === 'success'); // Allow gpsStatus to override if needed

    if (hasLocation) {
      return { icon: Signal, color: 'text-[#22c55e]', bg: 'bg-[#22c55e]/20', border: 'border-[#22c55e]/50', text: '已定位' }
    }

    switch (gpsStatus) {
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
      const isNative = await isNativePlatform();
      if (!isNative) {
        toast.info("网页端请允许浏览器定位权限");
        window.location.reload();
        return;
      }

      // Native Permission Flow
      const status = await safeRequestGeolocationPermission();

      if (status === 'denied') {
        toast.error("定位权限被拒绝", {
          description: "请前往系统设置中手动开启定位权限"
        });
      } else if (status === 'granted') {
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
      <div className="fixed top-0 left-0 right-0 z-[100] px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
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
      <div className="fixed top-0 left-0 right-0 z-[100] px-4 transition-all duration-300 pt-[calc(env(safe-area-inset-top)+1rem)] max-w-md mx-auto">
        <GlassCard className="p-1">
          <div className="flex items-center justify-between gap-2">
            {/* 左侧：城市选择器 */}
            <button
              onClick={() => openDrawer('city')}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <span className="text-xl">{currentCity.icon}</span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-bold text-white">
                  {/* Show cached district immediately; only show "定位中..." if locating AND no cached value */}
                  {(gpsStatus === 'locating' && !currentDistrict) ? '定位中...' : (currentDistrict || '未知位置')}
                </span>
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
                    <div className="h-1 rounded-full bg-secondary/30 overflow-hidden">
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
                <GpsIcon className={`w-3 h-3 ${gpsConfig.color} ${(gpsConfig.text === '定位中' || gpsConfig.text === '请求中') ? 'animate-spin' : ''}`} />
                <span className={`text-[10px] font-bold ${gpsConfig.color}`}>{gpsConfig.text}</span>
              </button>

            </div>
          </div>
        </GlassCard>
      </div>

      {/* Floating Action Buttons — only shown when view mode toggle is needed */}
      {onViewModeChange && (
        <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+6rem)] flex flex-col gap-3 pointer-events-auto">
          <button
            onClick={() => onViewModeChange(viewMode === 'user' ? 'club' : 'user')}
            className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white shadow-lg transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            {viewMode === 'user' ? (
              <User className="w-5 h-5" />
            ) : (
              <Users className="w-5 h-5 text-primary" />
            )}
          </button>
        </div>
      )}

      {/* 城市切换抽屉 */}
      <CityDrawer isOpen={activeDrawer === 'city'} onClose={closeDrawer} />

      {/* 登录提示弹窗 */}
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}
