"use client"

import React, { useState, useEffect } from "react"
import {
  CaptureRipple,
  HexCaptureRipple,
  CountingNumber,
  CountingArea,
  CountingDistance,
  CountingPoints,
  CityTransition,
  MapSweepTransition,
  ThemedGradientButton,
  ThemedCard,
  ThemedProgressBar,
} from "@/components/micro-interactions"
import { MapHeader } from "@/components/map/MapHeader"
import { useTheme } from "@/components/citylord/theme/theme-provider"
import { useCity } from "@/contexts/CityContext"
import { Sparkles, Target, Zap, Plane, ArrowRight } from "lucide-react"
import { useHydration } from "@/hooks/useHydration"

export default function MicroInteractionsDemoPage() {
  const [showRipple, setShowRipple] = useState(false)
  const [showHexRipple, setShowHexRipple] = useState(false)
  const [showCityTransition, setShowCityTransition] = useState(false)
  const [showMapSweep, setShowMapSweep] = useState(false)
  const [countValue, setCountValue] = useState(100)
  const [areaValue, setAreaValue] = useState(50000)
  const [distanceValue, setDistanceValue] = useState(1200)
  const [pointsValue, setPointsValue] = useState(500)
  const [progress, setProgress] = useState(65)
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const [showThemeSwitcher, setShowThemeSwitcher] = useState(false);
  const [isCityDrawerOpen, setIsCityDrawerOpen] = useState(false)
  const { theme } = useTheme()
  const { currentCity, isLoading: isCityLoading } = useCity()
  const hydrated = useHydration()

  // 等待 hydration 和城市加载完成
  if (!hydrated || isCityLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-white/60">加载中...</div>
      </div>
    )
  }

  // Handle window size for SSR compatibility
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight })
    }
    updateWindowSize()
    window.addEventListener('resize', updateWindowSize)
    return () => window.removeEventListener('resize', updateWindowSize)
  }, [])

  const triggerRipple = () => {
    setShowRipple(true)
    setTimeout(() => setShowRipple(false), 1000)
  }

  const triggerHexRipple = () => {
    setShowHexRipple(true)
    setTimeout(() => setShowHexRipple(false), 1500)
  }

  const triggerCityTransition = () => {
    setShowCityTransition(true)
    setTimeout(() => setShowCityTransition(false), 2000)
  }

  const triggerMapSweep = () => {
    setShowMapSweep(true)
    setTimeout(() => setShowMapSweep(false), 2500)
  }

  const incrementCount = () => {
    setCountValue((prev) => prev + 100)
  }

  const incrementArea = () => {
    setAreaValue((prev) => prev + 10000)
  }

  const incrementDistance = () => {
    setDistanceValue((prev) => prev + 500)
  }

  const incrementPoints = () => {
    setPointsValue((prev) => prev + 200)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {/* 地图头部 */}
      <MapHeader isCityDrawerOpen={isCityDrawerOpen} setIsCityDrawerOpen={setIsCityDrawerOpen} setShowThemeSwitcher={setShowThemeSwitcher} />

      {/* 占领反馈波纹动画 */}
      {showRipple && (
        <CaptureRipple
          x={windowSize.width / 2}
          y={windowSize.height / 2}
          color={currentCity?.themeColors.primary || "#22c55e"}
          size={150}
          duration={1000}
          onComplete={() => setShowRipple(false)}
          isTriggered={showRipple}
        />
      )}

      {/* 六边形波纹动画 */}
      {showHexRipple && (
        <HexCaptureRipple
          centerX={windowSize.width / 2}
          centerY={windowSize.height / 2}
          hexSize={30}
          color={currentCity?.themeColors.primary || "#22c55e"}
          onComplete={() => setShowHexRipple(false)}
          isTriggered={showHexRipple}
        />
      )}

      {/* 城市切换转场 */}
      <CityTransition
        fromCityName="北京"
        toCityName="上海"
        isActive={showCityTransition}
        onComplete={() => setShowCityTransition(false)}
        duration={2000}
      />

      {/* 地图扫掠转场 */}
      <MapSweepTransition
        fromCity={{ name: "成都", color: "#22c55e" }}
        toCity={{ name: "广州", color: "#f59e0b" }}
        isActive={showMapSweep}
        onComplete={() => setShowMapSweep(false)}
        duration={2500}
      />

      {/* 主内容 */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* 标题 */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">微交互动效演示</h1>
          <p className="text-white/60">展示所有微交互动画效果</p>
        </div>

        {/* 占领反馈部分 */}
        <ThemedCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-6 w-6" style={{ color: currentCity?.themeColors.primary }} />
            <h2 className="text-2xl font-bold text-white">占领反馈</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 圆形波纹 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">圆形波纹</h3>
              <p className="text-sm text-white/60 mb-4">点击按钮触发从中心向外扩散的波纹动画</p>
              <ThemedGradientButton
                variant="primary"
                onClick={triggerRipple}
                className="w-full"
              >
                触发圆形波纹
              </ThemedGradientButton>
            </div>

            {/* 六边形波纹 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">六边形波纹</h3>
              <p className="text-sm text-white/60 mb-4">点击按钮触发六边形占领动画</p>
              <ThemedGradientButton
                variant="secondary"
                onClick={triggerHexRipple}
                className="w-full"
              >
                触发六边形波纹
              </ThemedGradientButton>
            </div>
          </div>
        </ThemedCard>

        {/* 数字滚动部分 */}
        <ThemedCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6" style={{ color: currentCity?.themeColors.secondary }} />
            <h2 className="text-2xl font-bold text-white">数字滚动</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 计数器 */}
            <div className="space-y-2">
              <p className="text-sm text-white/60">基础计数器</p>
              <div className="rounded-xl bg-black/40 p-4 text-center">
                <p className="text-4xl font-bold text-white">
                  <CountingNumber value={countValue} duration={1000} isTriggered />
                </p>
              </div>
              <ThemedGradientButton
                variant="success"
                size="sm"
                onClick={incrementCount}
                className="w-full"
              >
                +100
              </ThemedGradientButton>
            </div>

            {/* 面积计数 */}
            <div className="space-y-2">
              <p className="text-sm text-white/60">占领面积</p>
              <div className="rounded-xl bg-black/40 p-4 text-center">
                <p className="text-4xl font-bold text-white">
                  <CountingArea area={areaValue} unit="m²" duration={1200} isTriggered />
                </p>
              </div>
              <ThemedGradientButton
                variant="success"
                size="sm"
                onClick={incrementArea}
                className="w-full"
              >
                +10,000 m²
              </ThemedGradientButton>
            </div>

            {/* 距离计数 */}
            <div className="space-y-2">
              <p className="text-sm text-white/60">跑步距离</p>
              <div className="rounded-xl bg-black/40 p-4 text-center">
                <p className="text-4xl font-bold text-white">
                  <CountingDistance distance={distanceValue} unit="km" decimals={2} duration={1500} isTriggered />
                </p>
              </div>
              <ThemedGradientButton
                variant="success"
                size="sm"
                onClick={incrementDistance}
                className="w-full"
              >
                +500 m
              </ThemedGradientButton>
            </div>

            {/* 积分计数 */}
            <div className="space-y-2">
              <p className="text-sm text-white/60">获得积分</p>
              <div className="rounded-xl bg-black/40 p-4 text-center">
                <p className="text-4xl font-bold text-white">
                  <CountingPoints points={pointsValue} duration={1500} isTriggered />
                </p>
              </div>
              <ThemedGradientButton
                variant="success"
                size="sm"
                onClick={incrementPoints}
                className="w-full"
              >
                +200
              </ThemedGradientButton>
            </div>
          </div>
        </ThemedCard>

        {/* 城市切换转场部分 */}
        <ThemedCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Plane className="h-6 w-6" style={{ color: currentCity?.themeColors.primary }} />
            <h2 className="text-2xl font-bold text-white">城市切换转场</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 飞机飞行模式 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">飞机飞行模式</h3>
              <p className="text-sm text-white/60 mb-4">点击按钮触发飞机飞行动画转场</p>
              <ThemedGradientButton
                variant="primary"
                onClick={triggerCityTransition}
                className="w-full"
              >
                <div className="flex items-center justify-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  北京 → 上海
                </div>
              </ThemedGradientButton>
            </div>

            {/* 地图扫掠模式 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">地图扫掠模式</h3>
              <p className="text-sm text-white/60 mb-4">点击按钮触发地图快速扫掠转场</p>
              <ThemedGradientButton
                variant="secondary"
                onClick={triggerMapSweep}
                className="w-full"
              >
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5" />
                  成都 → 广州
                </div>
              </ThemedGradientButton>
            </div>
          </div>
        </ThemedCard>

        {/* 主题适配部分 */}
        <ThemedCard className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-6 w-6" style={{ color: currentCity?.themeColors.secondary }} />
            <h2 className="text-2xl font-bold text-white">主题适配</h2>
          </div>

          <div className="mb-6 p-4 rounded-xl bg-black/40">
            <p className="text-sm text-white/60 mb-2">当前主题: <span className="font-bold text-white">{theme.name}</span></p>
            <p className="text-sm text-white/60">当前城市: <span className="font-bold text-white">{currentCity?.name || "未选择"}</span></p>
          </div>

          <div className="space-y-6">
            {/* 按钮示例 */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">按钮渐变</h3>
              <div className="flex flex-wrap gap-3">
                <ThemedGradientButton variant="primary" size="sm">Primary</ThemedGradientButton>
                <ThemedGradientButton variant="secondary" size="sm">Secondary</ThemedGradientButton>
                <ThemedGradientButton variant="success" size="sm">Success</ThemedGradientButton>
                <ThemedGradientButton variant="danger" size="sm">Danger</ThemedGradientButton>
              </div>
            </div>

            {/* 卡片示例 */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">卡片样式</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <ThemedCard variant="default" interactive className="p-4">
                  <p className="text-sm text-white">Default</p>
                </ThemedCard>
                <ThemedCard variant="glow" interactive className="p-4">
                  <p className="text-sm text-white">Glow</p>
                </ThemedCard>
                <ThemedCard variant="bordered" interactive className="p-4">
                  <p className="text-sm text-white">Bordered</p>
                </ThemedCard>
              </div>
            </div>

            {/* 进度条示例 */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">进度条</h3>
              <div className="space-y-3">
                <ThemedProgressBar progress={progress} showPercentage />
                <ThemedProgressBar progress={progress} animated />
                <ThemedProgressBar progress={progress} showPercentage animated />
                <ThemedGradientButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setProgress(Math.min(100, progress + 10))}
                >
                  增加进度
                </ThemedGradientButton>
              </div>
            </div>
          </div>
        </ThemedCard>
      </div>
    </div>
  )
}
