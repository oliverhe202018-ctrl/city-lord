"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { useGameStore } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration"
import { 
  latLngToCell, 
  cellToBoundary, 
  getDisk, 
  getViewportCells,
  HexagonCell,
  RENDER_RADIUS,
  H3_RESOLUTION,
  MAX_RENDER_COUNT
} from "@/lib/hex-utils"

interface GeoHexGridProps {
  width?: number
  height?: number
  hexSize?: number
  onHexClick?: (cellId: string, lat: number, lng: number) => void
  onHexHover?: (cellId: string | null) => void
  showLabels?: boolean
  showProgress?: boolean
}

/**
 * 基于真实 GPS 坐标的动态六边形网格组件
 * 
 * 特性：
 * - 从 useGameStore 读取用户实时坐标
 * - 使用 H3 算法生成地理网格
 * - 只渲染视口范围内的六边形（性能优化）
 * - 支持点击、悬停交互
 * - 自动更新（GPS 位置变化时）
 */
export function GeoHexGrid({
  width = 800,
  height = 600,
  hexSize = 20,
  onHexClick,
  onHexHover,
  showLabels = false,
  showProgress = false,
}: GeoHexGridProps) {
  // 从 store 读取用户位置
  const latitude = useGameStore((state) => state.latitude)
  const longitude = useGameStore((state) => state.longitude)
  const isHydrated = useHydration()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hexagons, setHexagons] = useState<HexagonCell[]>([])

  if (!isHydrated) return null
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 地图视图参数
  const [viewParams, setViewParams] = useState({
    centerLat: latitude || 39.9042, // 默认北京天安门
    centerLng: longitude || 116.4074,
    zoom: 14, // 缩放级别
  })

  // 生成六边形网格
  const generateHexGrid = useCallback(() => {
    try {
      if (!viewParams.centerLat || !viewParams.centerLng) {
        throw new Error("无效的中心坐标")
      }

      setLoading(true)
      setError(null)

      // 方法1：使用 getDisk（基于中心点扩展）
      const centerId = latLngToCell(viewParams.centerLat, viewParams.centerLng, H3_RESOLUTION)
      const disk = getDisk(centerId, RENDER_RADIUS)

      // 方法2：使用 getViewportCells（基于视口范围）
      // const cells = getViewportCells(viewParams.centerLat, viewParams.centerLng, 2, 2)

      // 限制最大渲染数量
      const cells = disk.cells.slice(0, MAX_RENDER_COUNT)

      console.log(`生成 ${cells.length} 个六边形（半径 ${RENDER_RADIUS} 圈）`)
      setHexagons(cells)
      setLoading(false)
    } catch (err) {
      console.error("生成六边形网格失败:", err)
      setError(err instanceof Error ? err.message : "未知错误")
      setLoading(false)
    }
  }, [viewParams.centerLat, viewParams.centerLng])

  // 使用 ref 跟踪是否需要重新生成网格
  const needsRegenRef = useRef(false)

  // 监听用户位置变化
  useEffect(() => {
    if (latitude && longitude) {
      const hasChanged = viewParams.centerLat !== latitude || viewParams.centerLng !== longitude
      if (hasChanged) {
        setViewParams(prev => ({
          ...prev,
          centerLat: latitude,
          centerLng: longitude,
        }))
        needsRegenRef.current = true
      }
    }
  }, [latitude, longitude, viewParams.centerLat, viewParams.centerLng])

  // 当视图参数变化时，重新生成六边形网格
  useEffect(() => {
    if (!needsRegenRef.current) return
    needsRegenRef.current = false

    const timer = setTimeout(() => {
      generateHexGrid()
    }, 300) // 防抖

    return () => clearTimeout(timer)
  }, []) // 不依赖 generateHexGrid，通过 needsRegenRef 触发

  // 将地理坐标转换为画布坐标
  const geoToCanvas = useCallback((
    lat: number,
    lng: number
  ): { x: number; y: number } => {
    // 简单投影：将经纬度映射到画布坐标
    // 实际项目中应该使用墨卡托投影或其他地图投影
    
    const x = width / 2 + (lng - viewParams.centerLng) * 100000 * (viewParams.zoom / 10)
    const y = height / 2 - (lat - viewParams.centerLat) * 100000 * (viewParams.zoom / 10)

    return { x, y }
  }, [width, height, viewParams.centerLat, viewParams.centerLng, viewParams.zoom])

  // 将画布坐标转换为地理坐标
  const canvasToGeo = useCallback((
    x: number,
    y: number
  ): { lat: number; lng: number } => {
    const lng = viewParams.centerLng + (x - width / 2) / 100000 / (viewParams.zoom / 10)
    const lat = viewParams.centerLat - (y - height / 2) / 100000 / (viewParams.zoom / 10)

    return { lat, lng }
  }, [width, height, viewParams.centerLat, viewParams.centerLng, viewParams.zoom])

  // 渲染六边形
  const renderHexagon = useCallback((
    ctx: CanvasRenderingContext2D,
    boundary: Array<{ lat: number; lng: number }>,
    isHovered: boolean = false
  ) => {
    if (boundary.length === 0) return

    ctx.beginPath()
    boundary.forEach((point, index) => {
      const { x, y } = geoToCanvas(point.lat, point.lng)
      
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.closePath()

    // 填充
    if (isHovered) {
      ctx.fillStyle = "rgba(57, 255, 20, 0.4)" // 悬停高亮
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)" // 默认填充
    }
    ctx.fill()

    // 描边
    ctx.strokeStyle = isHovered ? "#39ff14" : "rgba(255, 255, 255, 0.3)"
    ctx.lineWidth = isHovered ? 2 : 1
    ctx.stroke()
  }, [geoToCanvas])

  // 处理画布点击
  const handleCanvasClick = useCallback((
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    if (!onHexClick) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // 找到点击的六边形
    const clickedHex = hexagons.find(hex => {
      const { x: hexX, y: hexY } = geoToCanvas(hex.centerLat, hex.centerLng)
      const distance = Math.sqrt(Math.pow(x - hexX, 2) + Math.pow(y - hexY, 2))
      return distance < hexSize * 0.866 // 粗略判断
    })

    if (clickedHex) {
      onHexClick(clickedHex.id, clickedHex.centerLat, clickedHex.centerLng)
    }
  }, [hexagons, geoToCanvas, hexSize, onHexClick])

  // 处理画布悬停
  const handleCanvasMove = useCallback((
    event: React.MouseEvent<HTMLCanvasElement>
  ) => {
    if (!onHexHover) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // 找到悬停的六边形
    const hoveredHex = hexagons.find(hex => {
      const { x: hexX, y: hexY } = geoToCanvas(hex.centerLat, hex.centerLng)
      const distance = Math.sqrt(Math.pow(x - hexX, 2) + Math.pow(y - hexY, 2))
      return distance < hexSize * 0.866
    })

    const cellId = hoveredHex ? hoveredHex.id : null
    setHoveredCell(cellId)
    onHexHover(cellId)
  }, [hexagons, geoToCanvas, hexSize, onHexHover])

  // 绘制到 Canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 清除画布
    ctx.clearRect(0, 0, width, height)

    // 绘制背景
    ctx.fillStyle = "#0a0a0a"
    ctx.fillRect(0, 0, width, height)

    // 绘制网格线
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"
    ctx.lineWidth = 1
    
    // 绘制十字线
    ctx.beginPath()
    ctx.moveTo(width / 2, 0)
    ctx.lineTo(width / 2, height)
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    // 绘制所有六边形
    hexagons.forEach(hex => {
      const isHovered = hex.id === hoveredCell
      renderHexagon(ctx, hex.boundary, isHovered)

      // 绘制标签（可选）
      if (showLabels) {
        const { x, y } = geoToCanvas(hex.centerLat, hex.centerLng)
        ctx.fillStyle = isHovered ? "#39ff14" : "rgba(255, 255, 255, 0.5)"
        ctx.font = "8px Arial"
        ctx.textAlign = "center"
        ctx.fillText(hex.id.slice(-4), x, y)
      }

      // 绘制进度（可选）
      if (showProgress) {
        const { x, y } = geoToCanvas(hex.centerLat, hex.centerLng)
        const progress = Math.random() // 模拟进度
        
        ctx.fillStyle = "rgba(57, 255, 20, 0.3)"
        ctx.beginPath()
        ctx.arc(x, y, hexSize * 0.3, 0, Math.PI * 2 * progress)
        ctx.fill()
      }
    })

    // 绘制中心点（用户位置）
    if (viewParams.centerLat && viewParams.centerLng) {
      const { x, y } = geoToCanvas(viewParams.centerLat, viewParams.centerLng)
      
      // 绘制用户位置标记
      ctx.fillStyle = "#ff6b6b"
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.fill()
      
      // 绘制脉冲动画
      ctx.strokeStyle = "rgba(255, 107, 107, 0.5)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, 10, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, [hexagons, hoveredCell, width, height, geoToCanvas, renderHexagon, showLabels, showProgress, viewParams])

  return (
    <div className="relative">
      {/* 状态指示器 */}
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        {loading && (
          <div className="px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs">
            加载中...
          </div>
        )}
        {error && (
          <div className="px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}
        <div className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs">
          {hexagons.length} 个六边形
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMove}
        onMouseLeave={() => {
          setHoveredCell(null)
          onHexHover?.(null)
        }}
        className="rounded-lg border border-white/10 cursor-crosshair"
        style={{ touchAction: "none" }}
      />

      {/* 悬停信息 */}
      {hoveredCell && (
        <div className="absolute bottom-2 right-2 z-10 px-3 py-2 rounded-lg bg-black/80 backdrop-blur-sm border border-white/20">
          <p className="text-xs text-white/80">H3 ID: {hoveredCell}</p>
        </div>
      )}

      {/* 当前位置信息 */}
      {viewParams.centerLat && viewParams.centerLng && (
        <div className="absolute bottom-2 left-2 z-10 px-3 py-2 rounded-lg bg-black/80 backdrop-blur-sm border border-white/20">
          <p className="text-xs text-white/80">
            位置: {viewParams.centerLat.toFixed(4)}, {viewParams.centerLng.toFixed(4)}
          </p>
        </div>
      )}
    </div>
  )
}
