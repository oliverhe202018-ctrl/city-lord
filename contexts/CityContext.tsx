"use client"

import React, { createContext, useState, useCallback, useEffect, useContext } from "react";
import { useRegion } from "@/contexts/RegionContext";
import type { City, UserCityProgress, CitySwitchHistory } from "@/types/city"
import { getCityById, getAllCities, getCityByAdcode } from "@/lib/mock-data"
import { fetchCityData, type CityDataResponse } from "@/services/mock-api"

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
  leaderboard: CityDataResponse["leaderboard"] | null
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
const CityContext = createContext<CityContextType | undefined>(undefined)

/**
 * CityContext Provider 组件
 */
export function CityProvider({ children }: { children: React.ReactNode }) {
  const [currentCity, setCurrentCity] = useState<City | null>(null)
  const [currentCityProgress, setCurrentCityProgress] = useState<UserCityProgress | null>(null)
  const [switchHistory, setSwitchHistory] = useState<CitySwitchHistory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<CityDataResponse["leaderboard"] | null>(null)
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
   * 模拟生成用户城市进度数据
   */
  const generateMockProgress = useCallback((cityId: string): UserCityProgress | null => {
    const city = getCityById(cityId)
    if (!city) return null

    // 使用 cityId 作为随机种子,确保同一城市的进度数据一致
    const seededRandom = (seed: string) => {
      let hash = 0
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i)
        hash = hash & hash // Convert to 32bit integer
      }
      const random = () => {
        const x = Math.sin(hash++) * 10000
        return x - Math.floor(x)
      }
      return random
    }

    const random = seededRandom(cityId)

    return {
      userId: "mock-user-001",
      cityId,
      level: Math.floor(random() * 20) + 1,
      experience: Math.floor(random() * 5000),
      experienceProgress: {
        current: Math.floor(random() * 100),
        max: 100,
      },
      tilesCaptured: Math.floor(random() * 500),
      areaControlled: Math.floor(random() * 50 * 100) / 100,
      ranking: Math.floor(random() * 1000) + 1,
      reputation: Math.floor(random() * 10000),
      completedChallenges: [],
      unlockedAchievements: [],
      lastActiveAt: new Date().toISOString(),
      joinedAt: new Date(Date.now() - random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }, [])

  /**
   * 获取指定城市的进度数据
   */
  const getCityProgress = useCallback(
    (cityId: string): UserCityProgress | null => {
      if (cityId === currentCityRef.current?.id) {
        return currentCityProgressRef.current
      }
      // 在实际应用中，这里应该从 API 或数据库获取
      // 目前返回模拟数据
      return generateMockProgress(cityId)
    },
    [generateMockProgress]
  )

  /**
   * 切换城市的方法
   */
  const switchCity = useCallback(
    async (adcode: string) => {
      const targetCity = getCityByAdcode(adcode)
      if (!targetCity) {
        console.error(`City with adcode ${adcode} not found`)
        return
      }

      setIsLoading(true)

      try {
        // 调用 Mock API 获取城市数据和排行榜
        const cityData = await fetchCityData(targetCity.id)

        // 记录切换历史
        if (currentCityRef.current) {
          const historyEntry: CitySwitchHistory = {
            fromCityId: currentCityRef.current.id,
            toCityId: targetCity.id,
            timestamp: new Date().toISOString(),
            reason: "user_selection",
          }
          setSwitchHistory((prev: CitySwitchHistory[]) => [historyEntry, ...prev].slice(0, 20)) // 只保留最近 20 条
        }

        // 更新 RegionContext，这会触发地图更新
        if (targetCity.coordinates) {
          setRegion({
            regionType: "city",
            cityName: targetCity.name,
            province: "中国", // Todo: 需要从数据中获取省份
            adcode: targetCity.adcode,
            centerLngLat: [targetCity.coordinates.lng, targetCity.coordinates.lat],
          })
        }

        // 更新城市和排行榜数据
        setCurrentCity(cityData.city)
        setLeaderboard(cityData.leaderboard)
        setTotalPlayers(cityData.totalPlayers)

        // 获取新城市的进度数据
        const progress = generateMockProgress(targetCity.id)
        setCurrentCityProgress(progress)

        // 本地存储当前城市 ID
        localStorage.setItem("currentCityId", targetCity.id)
      } catch (error) {
        console.error("Failed to switch city:", error)
        throw error
      } finally {
        setIsLoading(false)
      }
    },
    [generateMockProgress]
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

        // 调用 Mock API 获取城市数据和排行榜
        const cityData = await fetchCityData(city.id)

        if (!mounted) return

        setCurrentCity(cityData.city)
        setLeaderboard(cityData.leaderboard)
        setTotalPlayers(cityData.totalPlayers)

        const progress = generateMockProgress(city.id)
        setCurrentCityProgress(progress)

        // 如果没有保存的城市ID,保存默认城市ID
        if (!savedCityId) {
          localStorage.setItem("currentCityId", city.id)
        }
      } catch (error) {
        console.error("Failed to initialize city:", error)
        if (!mounted) return

        // 如果加载失败,仍然要设置默认城市
        const defaultCity = getCityById("beijing")
        if (defaultCity) {
          setCurrentCity(defaultCity)
          const progress = generateMockProgress("beijing")
          setCurrentCityProgress(progress)
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
      // 使用 setTimeout 避免在渲染过程中更新状态
      const timer = setTimeout(() => {
        // switchCity 会再次触发 RegionContext 更新，这里需要避免
        // 但由于我们已经在 switchCity 中更新了 RegionContext，这里其实是一个反向同步
        // 只有当 region 变了（比如 GPS 定位变了），我们才需要切换城市
        // 而如果是 switchCity 导致的 region 变化，这里的逻辑可能会导致循环
        // 不过由于 region.adcode 和 currentCity.adcode 应该已经一致了，所以不会进入这里
        
        switchCity(String(region.adcode)).catch(error => {
          console.error('Failed to sync city from region:', error);
        });
      }, 0);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region?.adcode, currentCity?.adcode, isLoading, switchCity])

  // 创建稳定的 context value - 使用 ref 避免依赖循环
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
    allCities,
    currentCity,
    currentCityProgress,
    isLoading,
    leaderboard,
    switchHistory,
    totalPlayers,
  ])

  return <CityContext.Provider value={contextValue}>{children}</CityContext.Provider>
}

/**
 * 使用 CityContext 的 Hook
 */
export function useCity() {
  const context = useContext(CityContext)
  if (context === undefined) {
    throw new Error("useCity must be used within a CityProvider")
  }
  return context
}

/**
 * 获取当前城市的 Hook（返回城市数据，如果未选择则抛出错误）
 */
export function useCurrentCity() {
  const { currentCity } = useCity()
  if (!currentCity) {
    throw new Error("No city selected")
  }
  return currentCity
}

/**
 * 安全获取当前城市的 Hook（可能返回 null）
 */
export function useCurrentCitySafe() {
  return useCity().currentCity
}
