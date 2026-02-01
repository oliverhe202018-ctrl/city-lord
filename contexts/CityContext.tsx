"use client"

import React, { createContext, useState, useCallback, useEffect, useContext } from "react";
import { useRegion } from "@/contexts/RegionContext";
import type { City, UserCityProgress, CitySwitchHistory } from "@/types/city"
import { getCityById, getAllCities, getCityByAdcode } from "@/lib/city-data"
import { fetchCityStats, fetchCityLeaderboard, getUserCityProgress, type CityLeaderboardEntry } from "@/app/actions/city"

/**
 * CityContext 接口定义
 */
interface CityContextType {
  /** 当前选中的城市 */
  currentCity: City | null
  /** 当前城市用户进度数据 */
  currentCityProgress: UserCityProgress | null
  /** 所有可用城市列表 */
  allCities: City[]
  /** 城市切换历史 */
  switchHistory: CitySwitchHistory[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 排行榜数据 */
  leaderboard: CityLeaderboardEntry[] | null
  /** 总玩家数 */
  totalPlayers: number
  /** 切换城市的方法 */
  switchCity: (adcode: string) => Promise<void>
  /** 获取指定城市的进度数据 */
  getCityProgress: (cityId: string) => UserCityProgress | null
  /** 清除切换历史 */
  clearSwitchHistory: () => void
}

/**
 * CityContext 创建
 */
export const CityContext = createContext<CityContextType | undefined>(undefined)

/**
 * CityContext Provider 组件
 */
export function CityProvider({ children }: { children: React.ReactNode }) {
  const [currentCity, setCurrentCity] = useState<City | null>(null)
  const [currentCityProgress, setCurrentCityProgress] = useState<UserCityProgress | null>(null)
  const [switchHistory, setSwitchHistory] = useState<CitySwitchHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<CityLeaderboardEntry[] | null>(null)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const { region, setRegion } = useRegion()

  // 使用 useMemo for allCities since it's derived data
  const allCities = React.useMemo(() => getAllCities(), [])

  // 使用 ref 存储 city，避免 switchCity 中的依赖问题
  const currentCityRef = React.useRef(currentCity)
  currentCityRef.current = currentCity
  const currentCityProgressRef = React.useRef(currentCityProgress)
  currentCityProgressRef.current = currentCityProgress

  /**
   * 获取指定城市的进度数据
   */
  const getCityProgress = useCallback(
    (cityId: string): UserCityProgress | null => {
      if (cityId === currentCityRef.current?.id) {
        return currentCityProgressRef.current
      }
      return null
    },
    []
  )

  /**
   * 切换城市的方法
   */
  const switchCity = useCallback(
    async (adcode: string) => {
      const targetCityBase = getCityByAdcode(adcode)
      if (!targetCityBase) {
        console.error(`City with adcode ${adcode} not found`)
        return
      }

      setIsLoading(true)

      try {
        // Fetch real data in parallel
        const [stats, leaderboardData, userProgress] = await Promise.all([
          fetchCityStats(targetCityBase.id),
          fetchCityLeaderboard(targetCityBase.id),
          getUserCityProgress(targetCityBase.id)
        ])

        // Merge stats into city object
        const targetCity = {
          ...targetCityBase,
          stats: {
            ...targetCityBase.stats,
            ...stats
          }
        }

        setCurrentCity(targetCity)
        setLeaderboard(leaderboardData)
        setTotalPlayers(stats.totalPlayers)
        setCurrentCityProgress(userProgress)

        // 更新 RegionContext
        setRegion({
          regionType: "city",
          cityName: targetCity.name,
          adcode: targetCity.adcode,
          centerLngLat: [targetCity.coordinates.lng, targetCity.coordinates.lat],
        })

        // 添加到历史记录
        setSwitchHistory((prev) => [
          {
            fromCityId: currentCityRef.current?.id || "",
            toCityId: targetCity.id,
            timestamp: new Date().toISOString(),
            reason: "user_selection",
          },
          ...prev,
        ])

        // 本地存储当前城市 ID
        localStorage.setItem("currentCityId", targetCity.id)
      } catch (error) {
        console.error("Failed to switch city:", error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [setRegion]
  )

  /**
   * 清除切换历史
   */
  const clearSwitchHistory = useCallback(() => {
    setSwitchHistory([])
  }, [])

  /**
   * 初始化：从本地存储恢复上次选择的城市，如果没有则选择默认城市
   */
  useEffect(() => {
    let mounted = true

    const initializeCity = async () => {
      try {
        const savedCityId = localStorage.getItem("currentCityId")
        const cityId = savedCityId || "beijing" // 默认选择北京
        const city = getCityById(cityId)
        if (!city) {
          throw new Error(`City with id ${cityId} not found`)
        }

        // Fetch real data
        const [stats, leaderboardData, userProgress] = await Promise.all([
          fetchCityStats(city.id),
          fetchCityLeaderboard(city.id),
          getUserCityProgress(city.id)
        ])

        if (!mounted) return

        const targetCity = {
          ...city,
          stats: {
            ...city.stats,
            ...stats
          }
        }

        setCurrentCity(targetCity)
        setLeaderboard(leaderboardData)
        setTotalPlayers(stats.totalPlayers)
        setCurrentCityProgress(userProgress)

        // 如果没有保存的城市ID,保存默认城市ID
        if (!savedCityId) {
          localStorage.setItem("currentCityId", city.id)
        }
      } catch (error) {
        console.error("Failed to initialize city:", error)
        if (!mounted) return

        // 如果加载失败,仍然要设置默认城市（降级处理，不带动态数据）
        const defaultCity = getCityById("beijing")
        if (defaultCity) {
          setCurrentCity(defaultCity)
          // setLeaderboard([]) // Keep empty or null
          // setCurrentCityProgress(null) // Keep null
          localStorage.setItem("currentCityId", "beijing")
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initializeCity()
    return () => {
      mounted = false
    }
  }, [])

  /**
   * 同步 RegionContext 的 adcode 到 CityContext
   */
  useEffect(() => {
    // 防止在加载过程中触发
    if (isLoading) {
      return;
    }

    // 只在 region.adcode 存在且与当前城市不同时才切换
    if (region?.adcode && region.adcode !== currentCity?.adcode) {
      const timer = setTimeout(() => {
        switchCity(String(region.adcode)).catch(error => {
          console.error('Failed to sync city from region:', error);
        });
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [region?.adcode, currentCity?.adcode, isLoading, switchCity])

  // 创建稳定的 context value
  const contextValue: CityContextType = React.useMemo(() => ({
    currentCity,
    currentCityProgress,
    allCities,
    switchHistory,
    isLoading,
    leaderboard,
    totalPlayers,
    switchCity,
    getCityProgress,
    clearSwitchHistory,
  }), [
    currentCity,
    currentCityProgress,
    allCities,
    switchHistory,
    isLoading,
    leaderboard,
    totalPlayers,
    switchCity,
    getCityProgress,
    clearSwitchHistory
  ])

  return (
    <CityContext.Provider value={contextValue}>
      {children}
    </CityContext.Provider>
  )
}

/**
 * useCity Hook
 */
export function useCity() {
  const context = useContext(CityContext)
  if (context === undefined) {
    throw new Error("useCity must be used within a CityProvider")
  }
  return context
}
