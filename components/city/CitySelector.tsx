"use client"

import React from "react"
import { useCity } from "@/contexts/CityContext"
import { ChevronDown } from "lucide-react"

/**
 * 城市选择器组件
 * 允许用户在不同城市之间切换
 */
export function CitySelector() {
  const { currentCity, allCities, switchCity, isLoading } = useCity()
  const [isOpen, setIsOpen] = React.useState(false)

  const handleCitySelect = async (adcode: string) => {
    setIsOpen(false)
    try {
      await switchCity(adcode)
    } catch (error) {
      console.error("Failed to switch city:", error)
      // 这里可以添加错误提示
    }
  }

  if (!currentCity) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20">
        <span className="text-sm text-white/60">加载中...</span>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* 当前城市显示按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-white/10 to-white/5 border border-white/20 hover:border-white/30 transition-all duration-200"
      >
        <span className="text-xl">{currentCity.icon}</span>
        <span className="text-sm font-medium text-white">{currentCity.name}</span>
        <ChevronDown
          className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* 城市下拉列表 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* 下拉菜单 */}
          <div className="absolute top-full left-0 mt-2 z-50 w-64 rounded-xl border border-white/20 bg-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="p-2">
              <p className="px-2 py-1 text-xs text-white/40 font-medium">选择城市</p>
              {allCities.map((city) => (
                <button
                  key={city.id}
                  onClick={() => handleCitySelect(city.adcode)}
                  disabled={isLoading}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    city.id === currentCity.id
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  }`}
                  style={{
                    borderLeft: city.id === currentCity.id ? `3px solid ${city.theme.primary}` : '3px solid transparent',
                  }}
                >
                  <span className="text-xl">{city.icon}</span>
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{city.name}</span>
                      {city.seasonStatus.isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">
                          赛季 {city.seasonStatus.currentSeason}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-white/50">
                        {city.stats.activePlayers.toLocaleString()} 活跃玩家
                      </span>
                      <span className="text-xs text-white/30">•</span>
                      <span className="text-xs text-white/50">
                        {(city.stats.capturedTiles / city.stats.totalTiles * 100).toFixed(1)}% 已占领
                      </span>
                    </div>
                  </div>
                  {city.id === currentCity.id && (
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
