"use client"

import React, { useState } from "react"
import { GeoHexGrid } from "@/components/map/GeoHexGrid"
import { useGeolocation } from "@/hooks/useGeolocation"
import { useGameStore } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration";
import { 
  MapPin, 
  Navigation, 
  Play, 
  Pause, 
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Layers,
  Target
} from "lucide-react"

/**
 * 地理六边形网格演示页面
 * 
 * 功能：
 * - 显示基于真实 GPS 坐标的六边形网格
 * - 支持缩放、平移
 * - 支持点击、悬停交互
 * - 显示当前 GPS 位置
 * - 模拟/真实 GPS 切换
 */
export default function GeoGridDemoPage() {
  // 地理定位
  const geo = useGeolocation({
    // watchInterval removed as it is not supported
  })

  // 用户状态
  const { 
    latitude, 
    longitude, 
    cityName, 
    isRunning, 
    distance, 
    duration, 
    speed,
    addExperience, 
    consumeStamina 
  } = useGameStore()

  const hydrated = useHydration();

  // 视图状态
  const [showLabels, setShowLabels] = useState(false)
  const [showProgress, setShowProgress] = useState(false)
  const [zoom, setZoom] = useState(14)
  const [selectedCell, setSelectedCell] = useState<string | null>(null)

  // 处理六边形点击
  const handleHexClick = (cellId: string, lat: number, lng: number) => {
    console.log("点击六边形:", cellId, lat, lng)
    setSelectedCell(cellId)

    // 模拟占领六边形
    addExperience(10)
    consumeStamina(5)
  }

  // 处理六边形悬停
  const handleHexHover = (cellId: string | null) => {
    // 可以在这里添加悬停逻辑
  }

  // 放大
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 1, 22))
  }

  // 缩小
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 1, 0))
  }

  // 重置视图
  const handleResetView = () => {
    setZoom(14)
    setSelectedCell(null)
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <div className="text-white/60">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* 头部 */}
      <header className="border-b border-white/10 bg-black/50 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-[#39ff14] to-[#00ff88] bg-clip-text text-transparent">
                地理六边形网格演示
              </h1>
              <p className="text-sm text-white/60 mt-1">
                基于 H3 地理算法的动态网格系统
              </p>
            </div>

            {/* GPS 状态 */}
            <div className="flex items-center gap-3">
              {geo.loading ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                  <Navigation className="w-4 h-4 text-yellow-400 animate-spin" />
                  <span className="text-sm text-yellow-400">定位中...</span>
                </div>
              ) : geo.error ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 border border-red-500/30">
                  <MapPin className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{geo.error.message}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30">
                  <Target className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">GPS 已连接</span>
                </div>
              )}

              {/* 模拟/真实切换 */}
              <button
                onClick={() => typeof window !== "undefined" && window.location.reload()}
                className="px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
              >
                <span className="text-sm text-blue-400">重置定位</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：地图区域 */}
          <div className="lg:col-span-2">
            <div className="bg-black/50 rounded-xl border border-white/10 p-4">
              {/* 工具栏 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                    title="放大"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                    title="缩小"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetView}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all"
                    title="重置视图"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 rounded-lg bg-white/10 text-sm text-white/80">
                    Zoom: {zoom}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLabels(!showLabels)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      showLabels
                        ? "bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14]"
                        : "bg-white/10 hover:bg-white/20 text-white/80"
                    }`}
                  >
                    <Layers className="w-4 h-4 inline mr-1" />
                    标签
                  </button>
                  <button
                    onClick={() => setShowProgress(!showProgress)}
                    className={`px-3 py-2 rounded-lg text-sm transition-all ${
                      showProgress
                        ? "bg-[#39ff14]/20 border border-[#39ff14]/50 text-[#39ff14]"
                        : "bg-white/10 hover:bg-white/20 text-white/80"
                    }`}
                  >
                    <Target className="w-4 h-4 inline mr-1" />
                    进度
                  </button>
                </div>
              </div>

              {/* 地图 */}
              <GeoHexGrid
                width={800}
                height={600}
                hexSize={20}
                onHexClick={handleHexClick}
                onHexHover={handleHexHover}
                showLabels={showLabels}
                showProgress={showProgress}
              />
            </div>

            {/* 选中的六边形信息 */}
            {selectedCell && (
              <div className="mt-4 bg-[#39ff14]/10 border border-[#39ff14]/30 rounded-xl p-4">
                <h3 className="text-lg font-semibold text-[#39ff14] mb-2">
                  <Target className="w-5 h-5 inline mr-2" />
                  已选中六边形
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-white/60">H3 ID</p>
                    <p className="text-white font-mono">{selectedCell}</p>
                  </div>
                  <div>
                    <p className="text-white/60">状态</p>
                    <p className="text-green-400">已占领</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：信息面板 */}
          <div className="space-y-4">
            {/* GPS 信息 */}
            <div className="bg-black/50 rounded-xl border border-white/10 p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" />
                当前位置
              </h3>
              {latitude && longitude ? (
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-white/60">纬度</p>
                    <p className="font-mono text-white">
                      {latitude.toFixed(6)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/60">经度</p>
                    <p className="font-mono text-white">
                      {longitude.toFixed(6)}
                    </p>
                  </div>

                  {cityName && (
                    <div>
                      <p className="text-xs text-white/60">城市</p>
                      <p className="text-sm text-white/80">{cityName}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-white/60">暂无位置信息</p>
              )}
            </div>

            {/* 跑步状态 */}
            <div className="bg-black/50 rounded-xl border border-white/10 p-4">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Navigation className="w-5 h-5 text-red-400" />
                跑步状态
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/60">状态</span>
                  <span className={`text-sm font-medium ${isRunning ? "text-green-400" : "text-white/80"}`}>
                    {isRunning ? "跑步中" : "未开始"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/60">距离</span>
                  <span className="text-sm text-white/80">
                    {distance.toFixed(0)} 米
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/60">时长</span>
                  <span className="text-sm text-white/80">
                    {Math.floor(duration / 60)} 分 {duration % 60} 秒
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-white/60">速度</span>
                  <span className="text-sm text-white/80">
                    {speed.toFixed(1)} m/s
                  </span>
                </div>
              </div>
            </div>

            {/* 操作说明 */}
            <div className="bg-black/50 rounded-xl border border-white/10 p-4">
              <h3 className="text-lg font-semibold mb-3">操作说明</h3>
              <ul className="space-y-2 text-sm text-white/80">
                <li className="flex items-start gap-2">
                  <span className="text-[#39ff14]">•</span>
                  <span>点击六边形可以占领该区域</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#39ff14]">•</span>
                  <span>使用放大/缩小按钮调整缩放级别</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#39ff14]">•</span>
                  <span>开启标签查看 H3 索引</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#39ff14]">•</span>
                  <span>开启进度查看占领进度</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#39ff14]">•</span>
                  <span>GPS 位置每秒自动更新（模拟模式）</span>
                </li>
              </ul>
            </div>

            {/* 技术信息 */}
            <div className="bg-black/50 rounded-xl border border-white/10 p-4">
              <h3 className="text-lg font-semibold mb-3">技术信息</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">H3 分辨率</span>
                  <span className="font-mono text-white/80">9</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">渲染半径</span>
                  <span className="font-mono text-white/80">{15} 圈</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">最大渲染</span>
                  <span className="font-mono text-white/80">{500} 个</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">六边形边长</span>
                  <span className="font-mono text-white/80">≈ 20 米</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
