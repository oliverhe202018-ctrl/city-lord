"use client"

import React, { createContext, useState, useCallback, useEffect, useContext, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
 * Helper: Convert AMap data to City object
 */
const convertAMapDataToCity = (data: any, parentAdcode?: string): City => {
  // Calculate bounds
  let north = -90, south = 90, east = -180, west = 180;
  if (data.boundaries && data.boundaries.length > 0) {
    data.boundaries.forEach((boundary: any[]) => {
      boundary.forEach((point: any) => {
        // Point can be object {lng, lat} or array [lng, lat]
        const lng = point.lng || point[0];
        const lat = point.lat || point[1];
        if (lat > north) north = lat;
        if (lat < south) south = lat;
        if (lng > east) east = lng;
        if (lng < west) west = lng;
      });
    });
  } else {
    // Fallback bounds if no boundaries returned (rare with extensions: all)
    const centerLng = data.center.lng || data.center[0];
    const centerLat = data.center.lat || data.center[1];
    north = centerLat + 0.1;
    south = centerLat - 0.1;
    east = centerLng + 0.1;
    west = centerLng - 0.1;
  }

  return {
    id: `city_${data.adcode}`,
    adcode: data.adcode,
    name: data.name,
    pinyin: '', // AMap doesn't return pinyin easily in this call, leave empty or TODO
    abbr: '',
    province: (data.province && typeof data.province === 'string') ? data.province : undefined, // Capture province
    level: data.level === 'district' ? 'district' : (data.level === 'city' ? 'city' : 'county'),
    parentAdcode: parentAdcode,
    coordinates: {
      lng: data.center.lng || data.center[0],
      lat: data.center.lat || data.center[1]
    },
    bounds: { north, south, east, west },
    // Default Theme
    theme: { primary: "#3b82f6", secondary: "#06b6d4", accent: "#8b5cf6", glow: "#3b82f6" },
    themeColors: { primary: "#3b82f6", secondary: "#06b6d4" },
    seasonStatus: {
      currentSeason: 1,
      startDate: new Date().toISOString(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      isActive: true
    },
    stats: {
      totalArea: 0, // Should be calculated or fetched
      totalPlayers: 0,
      activePlayers: 0,
      totalTiles: 0,
      capturedTiles: 0
    },
    description: `${data.name}欢迎你！`
  };
};

/**
 * Fetch city data from AMap API dynamically
 */
const fetchCityFromAMap = async (adcode: string): Promise<City | null> => {
  try {
    // Call AMap Geocoding API to get city information
    // Note: This is a placeholder implementation. You'll need to replace with actual AMap API calls
    // The actual implementation should fetch from AMap's administrative division search API
    console.log(`[fetchCityFromAMap] Fetching city ${adcode} from AMap...`);

    // For now, return null to indicate city not found
    // Implement AMap API integration here
    return null;
  } catch (error) {
    console.error('[fetchCityFromAMap] Error:', error);
    return null;
  }
};

/**
 * CityContext Provider 组件
 */
export function CityProvider({ children }: { children: React.ReactNode }) {
  const [activeBaseCity, setActiveBaseCity] = useState<City | null>(null)
  const [switchHistory, setSwitchHistory] = useState<CitySwitchHistory[]>([])
  const { region, setRegion } = useRegion()
  const queryClient = useQueryClient()

  // 使用 useMemo for allCities since it's derived data
  const allCities = React.useMemo(() => getAllCities(), [])

  // 1. Stats Query
  const { data: cityStats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['cityStats', activeBaseCity?.id],
    queryFn: () => fetchCityStats(activeBaseCity!.id),
    enabled: !!activeBaseCity?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // 2. Leaderboard Query
  const { data: leaderboardData, isLoading: isLeaderboardLoading } = useQuery({
    queryKey: ['cityLeaderboard', activeBaseCity?.id],
    queryFn: () => fetchCityLeaderboard(activeBaseCity!.id),
    enabled: !!activeBaseCity?.id,
    staleTime: 5 * 60 * 1000,
  })

  // 3. User Progress Query
  const { data: userProgress, isLoading: isProgressLoading } = useQuery({
    queryKey: ['userCityProgress', activeBaseCity?.id],
    queryFn: () => getUserCityProgress(activeBaseCity!.id),
    enabled: !!activeBaseCity?.id,
    staleTime: 5 * 60 * 1000,
  })

  // Derived currentCity
  const currentCity = useMemo(() => {
    if (!activeBaseCity) return null
    return {
      ...activeBaseCity,
      stats: {
        ...activeBaseCity.stats,
        ...(cityStats || {})
      }
    }
  }, [activeBaseCity, cityStats])

  const isLoading = isStatsLoading || isLeaderboardLoading || isProgressLoading

  // 使用 ref 存储 city，避免 switchCity 中的依赖问题
  const currentCityRef = React.useRef(currentCity)
  currentCityRef.current = currentCity
  
  const userProgressRef = React.useRef(userProgress)
  userProgressRef.current = userProgress

  /**
   * 获取指定城市的进度数据
   */
  const getCityProgress = useCallback(
    (cityId: string): UserCityProgress | null => {
      if (cityId === currentCityRef.current?.id) {
        return userProgressRef.current || null
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
      let targetCityBase = getCityByAdcode(adcode)
      
      // If not found in static data, try fetching dynamically
      if (!targetCityBase) {
        console.log(`City ${adcode} not found in static data, fetching from AMap...`);
        try {
          const dynamicCity = await fetchCityFromAMap(adcode);
          if (dynamicCity) {
            targetCityBase = dynamicCity;
          }
        } catch (err) {
          console.error('Error fetching dynamic city data:', err);
        }
      }

      // Fallback Logic: Try parent city (xx00) if specific district/county not found
      if (!targetCityBase && adcode.length === 6) {
          const parentAdcode = adcode.substring(0, 4) + '00';
          console.log(`City ${adcode} not found, trying parent city ${parentAdcode}...`);
          
          targetCityBase = getCityByAdcode(parentAdcode);
          
          // Try fetching parent dynamic if static failed
          if (!targetCityBase) {
              try {
                  const dynamicParent = await fetchCityFromAMap(parentAdcode);
                  if (dynamicParent) {
                      targetCityBase = dynamicParent;
                  }
              } catch (err) {
                  console.error('Error fetching dynamic parent city:', err);
              }
          }
      }

      if (!targetCityBase) {
        console.warn(`City with adcode ${adcode} (and parent) not found. Switch aborted.`)
        return
      }

      // Set active base city - this triggers the queries
      setActiveBaseCity(targetCityBase)

      // 更新 RegionContext
      setRegion({
        regionType: "city",
        cityName: targetCityBase.name,
        adcode: targetCityBase.adcode,
        centerLngLat: [targetCityBase.coordinates.lng, targetCityBase.coordinates.lat],
      })

      // 添加到历史记录
      setSwitchHistory((prev) => [
        {
          fromCityId: currentCityRef.current?.id || "",
          toCityId: targetCityBase!.id,
          timestamp: new Date().toISOString(),
          reason: "user_selection",
        },
        ...prev,
      ])

      // 本地存储当前城市 ID
      localStorage.setItem("currentCityId", targetCityBase.id)
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
             const defaultCity = getCityById("beijing")
             if(defaultCity && mounted) {
                 setActiveBaseCity(defaultCity)
                 localStorage.setItem("currentCityId", "beijing")
             }
             return
        }

        if (mounted) {
           setActiveBaseCity(city)
           if (!savedCityId) {
             localStorage.setItem("currentCityId", city.id)
           }
        }
      } catch (error) {
        console.error("Failed to initialize city:", error)
        if (mounted) {
            const defaultCity = getCityById("beijing")
            if (defaultCity) {
                setActiveBaseCity(defaultCity)
                localStorage.setItem("currentCityId", "beijing")
            }
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
    if (isLoading) {
      return;
    }

    // 只在 region.adcode 存在且与当前城市不同时才切换
    if (region?.adcode && region.adcode !== currentCity?.adcode) {
      // Avoid infinite loops by checking if we are already "stable"
      if (activeBaseCity?.adcode === region.adcode) return;

      const timer = setTimeout(() => {
        switchCity(String(region.adcode)).catch(error => {
          console.error('Failed to sync city from region:', error);
        });
      }, 0);

      return () => clearTimeout(timer);
    }
  }, [region?.adcode, currentCity?.adcode, isLoading, switchCity, activeBaseCity?.adcode])

  // 创建稳定的 context value
  const contextValue: CityContextType = React.useMemo(() => ({
    currentCity,
    currentCityProgress: userProgress || null,
    allCities,
    switchHistory,
    isLoading,
    leaderboard: leaderboardData || null,
    totalPlayers: cityStats?.totalPlayers || 0,
    switchCity,
    getCityProgress,
    clearSwitchHistory,
  }), [
    currentCity,
    userProgress,
    allCities,
    switchHistory,
    isLoading,
    leaderboardData,
    cityStats,
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
