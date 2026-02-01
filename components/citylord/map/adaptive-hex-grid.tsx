"use client"

import React from "react"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Crosshair, Eye, Shield, Swords, MapPin } from "lucide-react"
import {
  ScaleConfig,
  type ZoomLevelConfig,
  type HexCoordinate,
  type GpsAnchor,
  type HexLayout,
  ZOOM_LEVELS,
} from "@/lib/citylord/hex-scale-config"
import { formatArea } from "@/lib/citylord/area-utils"

// ============================================================
// Types
// ============================================================

type HexState = "unexplored" | "mine" | "enemy" | "neutral" | "contested"

interface HexCellData {
  coord: HexCoordinate
  state: HexState
  captureProgress?: number
  ownerId?: string
  lastUpdated?: number
}

interface AdaptiveHexGridProps {
  zoom: number
  centerLat: number
  centerLng: number
  userLat: number
  userLng: number
  viewportWidth: number
  viewportHeight: number
  hexData?: Map<string, HexCellData>
  onHexClick?: (coord: HexCoordinate, state: HexState) => void
  onZoomChange?: (newZoom: number, config: ZoomLevelConfig) => void
  showLegend?: boolean
  showUserLocation?: boolean
  gpsAnchor?: GpsAnchor
}

// ============================================================
// State Configuration
// ============================================================

const stateConfig: Record<HexState, { 
  fill: string
  stroke: string
  glow: string
  label: string
  icon: React.ElementType
}> = {
  unexplored: {
    fill: "rgba(255,255,255,0.02)",
    stroke: "rgba(255,255,255,0.1)",
    glow: "",
    label: "未探索",
    icon: Eye,
  },
  mine: {
    fill: "rgba(34,197,94,0.25)",
    stroke: "#22c55e",
    glow: "drop-shadow(0 0 8px rgba(34,197,94,0.6))",
    label: "我的领地",
    icon: Shield,
  },
  enemy: {
    fill: "rgba(239,68,68,0.25)",
    stroke: "#ef4444",
    glow: "drop-shadow(0 0 8px rgba(239,68,68,0.6))",
    label: "敌方",
    icon: Swords,
  },
  neutral: {
    fill: "rgba(255,255,255,0.05)",
    stroke: "rgba(255,255,255,0.25)",
    glow: "",
    label: "中立",
    icon: Crosshair,
  },
  contested: {
    fill: "rgba(234,179,8,0.25)",
    stroke: "#eab308",
    glow: "drop-shadow(0 0 8px rgba(234,179,8,0.6))",
    label: "争夺中",
    icon: Swords,
  },
}

// ============================================================
// Utility Functions
// ============================================================

function hexCoordToKey(coord: HexCoordinate): string {
  return `${coord.q},${coord.r}`
}

function keyToHexCoord(key: string): HexCoordinate {
  const [q, r] = key.split(",").map(Number)
  return { q, r, s: -q - r }
}

// Generate pointy-top hexagon SVG points
function getHexPoints(cx: number, cy: number, size: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    return `${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`
  }).join(" ")
}

// ============================================================
// Main Component
// ============================================================

export function AdaptiveHexGrid({
  zoom,
  centerLat,
  centerLng,
  userLat,
  userLng,
  viewportWidth,
  viewportHeight,
  hexData,
  onHexClick,
  onZoomChange,
  showLegend = true,
  showUserLocation = true,
  gpsAnchor = ScaleConfig.defaultAnchor,
}: AdaptiveHexGridProps) {
  // State
  const [currentZoomConfig, setCurrentZoomConfig] = useState<ZoomLevelConfig>(
    ScaleConfig.getZoomLevelConfig(zoom)
  )
  const [transitionOpacity, setTransitionOpacity] = useState(1)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  
  const prevZoomRef = useRef(zoom)
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const prevZoomConfigNameRef = useRef(currentZoomConfig.nameEn)

  // Memoize the onZoomChange callback to prevent unnecessary re-renders
  const handleZoomChange = useCallback((newZoom: number, config: ZoomLevelConfig) => {
    onZoomChange?.(newZoom, config)
  }, [onZoomChange])

  // Calculate layout based on current zoom config
  const layout = useMemo<HexLayout>(() => {
    // Calculate meters per pixel based on zoom level
    // At zoom 17, approximately 1.19 meters per pixel
    const metersPerPixel = (156543.03392 * Math.cos(centerLat * Math.PI / 180)) / Math.pow(2, zoom)
    
    // Calculate hex size in pixels
    const hexSizePixels = currentZoomConfig.hexRadiusMeters / metersPerPixel
    
    return {
      size: Math.max(hexSizePixels, 8), // Minimum 8px for visibility
      origin: { x: viewportWidth / 2, y: viewportHeight / 2 },
      anchor: gpsAnchor,
      metersPerPixel,
    }
  }, [zoom, centerLat, viewportWidth, viewportHeight, gpsAnchor, currentZoomConfig])

  // Handle zoom level changes with smooth transition
  useEffect(() => {
    const newConfig = ScaleConfig.getZoomLevelConfig(zoom)

    if (newConfig.nameEn !== prevZoomConfigNameRef.current) {
      // Zoom level threshold crossed - trigger transition
      setIsTransitioning(true)
      setTransitionOpacity(0)

      // Clear any existing timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }

      // Fade out, switch config, fade in
      transitionTimeoutRef.current = setTimeout(() => {
        setCurrentZoomConfig(newConfig)
        handleZoomChange(zoom, newConfig)

        // Fade in
        requestAnimationFrame(() => {
          setTransitionOpacity(1)

          transitionTimeoutRef.current = setTimeout(() => {
            setIsTransitioning(false)
          }, 300)
        })
      }, 150)

      prevZoomConfigNameRef.current = newConfig.nameEn
    }

    prevZoomRef.current = zoom
  }, [zoom, handleZoomChange])

  // Cleanup
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current)
      }
    }
  }, [])

  // Calculate visible hexes
  const visibleHexes = useMemo(() => {
    // Calculate viewport bounds in lat/lng
    const metersPerPixel = layout.metersPerPixel
    const halfWidthMeters = (viewportWidth / 2) * metersPerPixel
    const halfHeightMeters = (viewportHeight / 2) * metersPerPixel
    
    const { dLat: dLatHalf, dLng: dLngHalf } = ScaleConfig.metersToLatLng(
      halfWidthMeters,
      halfHeightMeters,
      centerLat
    )
    
    const bounds = {
      minLat: centerLat - Math.abs(dLatHalf),
      maxLat: centerLat + Math.abs(dLatHalf),
      minLng: centerLng - Math.abs(dLngHalf),
      maxLng: centerLng + Math.abs(dLngHalf),
    }
    
    // Get hex range for viewport
    const range = ScaleConfig.getVisibleHexRange(bounds, layout, currentZoomConfig)
    
    // Generate hexes within range
    const hexes: HexCellData[] = []
    const states: HexState[] = ["mine", "enemy", "neutral", "unexplored", "contested"]
    const weights = [0.2, 0.15, 0.25, 0.35, 0.05]
    
    const getRandomState = (q: number, r: number): HexState => {
      // Use deterministic random based on coordinates for consistency
      const seed = Math.abs(q * 31 + r * 37) % 100
      let cumulative = 0
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i] * 100
        if (seed < cumulative) return states[i]
      }
      return "neutral"
    }
    
    for (let q = range.minQ; q <= range.maxQ; q++) {
      for (let r = range.minR; r <= range.maxR; r++) {
        const coord: HexCoordinate = { q, r, s: -q - r }
        const key = hexCoordToKey(coord)
        
        // Check if we have existing data for this hex
        const existingData = hexData?.get(key)
        
        if (existingData) {
          hexes.push(existingData)
        } else {
          // Generate pseudo-random state
          const state = getRandomState(q, r)
          hexes.push({
            coord,
            state,
            captureProgress: state === "contested" ? Math.abs((q * 17 + r * 23) % 100) : undefined,
          })
        }
      }
    }
    
    // Get user's current hex for priority rendering
    const userHex = ScaleConfig.geoToHex(
      { lat: userLat, lng: userLng },
      layout,
      currentZoomConfig
    )
    
    // Limit hex count for performance
    return ScaleConfig.limitHexCount(
      hexes.map(h => h.coord),
      currentZoomConfig.maxRenderCount,
      userHex
    ).map(coord => {
      const key = hexCoordToKey(coord)
      return hexes.find(h => hexCoordToKey(h.coord) === key) || {
        coord,
        state: "unexplored" as HexState,
      }
    })
  }, [centerLat, centerLng, viewportWidth, viewportHeight, layout, currentZoomConfig, hexData, userLat, userLng])

  // Get user's current hex position
  const userHexCoord = useMemo(() => {
    return ScaleConfig.geoToHex(
      { lat: userLat, lng: userLng },
      layout,
      currentZoomConfig
    )
  }, [userLat, userLng, layout, currentZoomConfig])

  // Calculate area statistics
  const areaStats = useMemo(() => {
    const mineCount = visibleHexes.filter(h => h.state === "mine").length
    return ScaleConfig.calculateAreaStats(mineCount, currentZoomConfig)
  }, [visibleHexes, currentZoomConfig])

  // Count hexes by state
  const stateCounts = useMemo(() => {
    const counts: Record<HexState, number> = {
      unexplored: 0,
      mine: 0,
      enemy: 0,
      neutral: 0,
      contested: 0,
    }
    for (const hex of visibleHexes) {
      counts[hex.state]++
    }
    return counts
  }, [visibleHexes])

  // Handle hex click
  const handleHexClick = useCallback((hex: HexCellData) => {
    const key = hexCoordToKey(hex.coord)
    setSelectedHex(key)
    onHexClick?.(hex.coord, hex.state)
  }, [onHexClick])

  // Calculate pixel position for a hex
  const getHexPixelPosition = useCallback((coord: HexCoordinate) => {
    // Convert hex coord to pixel position relative to center
    const pixel = ScaleConfig.hexToPixel(coord, {
      ...layout,
      origin: { x: 0, y: 0 },
    })
    
    // Offset by user's hex position to center the view
    const userPixel = ScaleConfig.hexToPixel(userHexCoord, {
      ...layout,
      origin: { x: 0, y: 0 },
    })
    
    return {
      x: pixel.x - userPixel.x + viewportWidth / 2,
      y: pixel.y - userPixel.y + viewportHeight / 2,
    }
  }, [layout, userHexCoord, viewportWidth, viewportHeight])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Transparent Fog of War Overlay - Light overlay for better map visibility */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,10,15,0.2)_70%,rgba(10,10,15,0.3)_100%)]" />
      </div>

      {/* Grid Background - Removed to show real map */}
      {/* <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,197,94,0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,197,94,0.2) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      /> */}

      {/* SVG Hex Grid with transition */}
      <svg 
        className="absolute inset-0 h-full w-full transition-opacity duration-300"
        style={{ opacity: transitionOpacity }}
        viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glow filters */}
          <filter id="glow-mine" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-enemy" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-contested" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* User location pulse */}
          <radialGradient id="user-gradient">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Render hexes */}
        {visibleHexes.map((hex) => {
          const { x, y } = getHexPixelPosition(hex.coord)
          const key = hexCoordToKey(hex.coord)
          const config = stateConfig[hex.state]
          const isUserHex = hex.coord.q === userHexCoord.q && hex.coord.r === userHexCoord.r
          const isSelected = key === selectedHex

          // Skip hexes outside viewport (with padding)
          if (x < -layout.size * 2 || x > viewportWidth + layout.size * 2 ||
              y < -layout.size * 2 || y > viewportHeight + layout.size * 2) {
            return null
          }

          const getFilter = () => {
            if (hex.state === "mine") return "url(#glow-mine)"
            if (hex.state === "enemy") return "url(#glow-enemy)"
            if (hex.state === "contested") return "url(#glow-contested)"
            return undefined
          }

          return (
            <g 
              key={key} 
              onClick={() => handleHexClick(hex)} 
              className="cursor-pointer"
            >
              {/* User location pulse */}
              {isUserHex && showUserLocation && (
                <circle
                  cx={x}
                  cy={y}
                  r={layout.size * 1.8}
                  fill="url(#user-gradient)"
                  className="animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              )}
              
              {/* Selection ring */}
              {isSelected && (
                <polygon
                  points={getHexPoints(x, y, layout.size + 2)}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeDasharray="8 4"
                  className="animate-pulse"
                />
              )}

              {/* Main hex */}
              <polygon
                points={getHexPoints(x, y, layout.size)}
                fill={isUserHex ? "rgba(34,197,94,0.4)" : config.fill}
                stroke={isUserHex ? "#22c55e" : config.stroke}
                strokeWidth={isSelected || isUserHex ? "2.5" : "1.5"}
                filter={getFilter()}
                className="transition-all duration-200 hover:brightness-125"
              />

              {/* Capture progress (only in close zoom) */}
              {currentZoomConfig.showProgress && hex.state === "contested" && hex.captureProgress !== undefined && (
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-yellow-400 text-[10px] font-bold"
                >
                  {hex.captureProgress}%
                </text>
              )}

              {/* User location marker */}
              {isUserHex && showUserLocation && (
                <g>
                  <circle cx={x} cy={y} r={6} fill="#22c55e" />
                  <circle cx={x} cy={y} r={3} fill="#ffffff" />
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* Zoom Level Indicator */}
      <div className="absolute left-4 top-4 z-20 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-wider text-white/40">缩放级别</p>
        <p className="text-sm font-bold text-[#22c55e]">{currentZoomConfig.name}</p>
        <p className="text-[10px] text-white/40">
          格子: {currentZoomConfig.hexRadiusMeters}m
        </p>
      </div>

      {/* Area Stats */}
      <div className="absolute right-4 top-4 z-20 rounded-xl border border-white/10 bg-black/60 px-3 py-2 backdrop-blur-xl">
        <p className="text-[10px] uppercase tracking-wider text-white/40">我的领地</p>
        <p className="text-lg font-bold text-[#22c55e]">
          {areaStats.formattedArea.value}
          <span className="ml-1 text-xs font-normal text-white/40">{areaStats.formattedArea.unit}</span>
        </p>
      </div>

      {/* Transition indicator */}
      {isTransitioning && (
        <div className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <div className="rounded-xl border border-[#22c55e]/30 bg-black/80 px-4 py-2 backdrop-blur-xl">
            <p className="text-sm text-[#22c55e]">切换网格密度...</p>
          </div>
        </div>
      )}

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <div className="rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/40">图例</span>
              <span className="text-[10px] text-white/40">
                单格面积: {formatArea(currentZoomConfig.hexAreaSqMeters).fullText}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(stateConfig) as HexState[]).map((state) => {
                const config = stateConfig[state]
                const Icon = config.icon
                return (
                  <div key={state} className="flex flex-col items-center gap-1">
                    <div 
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{ 
                        backgroundColor: config.fill,
                        border: `1px solid ${config.stroke}`,
                      }}
                    >
                      <Icon className="h-4 w-4" style={{ color: config.stroke }} />
                    </div>
                    <span className="text-[10px] text-white/60">{stateCounts[state]}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Export Demo Component
// ============================================================

export function AdaptiveHexGridDemo() {
  const [zoom, setZoom] = useState(17)
  
  // Simulate user location (Beijing)
  const userLat = 39.9042
  const userLng = 116.4074
  
  return (
    <div className="relative h-full w-full">
      <AdaptiveHexGrid
        zoom={zoom}
        centerLat={userLat}
        centerLng={userLng}
        userLat={userLat}
        userLng={userLng}
        viewportWidth={400}
        viewportHeight={700}
        onZoomChange={(newZoom, config) => {
          console.log(`Zoom changed to ${newZoom}, config: ${config.name}`)
        }}
      />
      
      {/* Zoom controls */}
      <div className="absolute bottom-24 right-4 z-30 flex flex-col gap-2">
        <button
          onClick={() => setZoom(Math.min(22, zoom + 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/60 text-white backdrop-blur-xl transition-all hover:bg-white/10"
        >
          +
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/60 text-xs font-bold text-[#22c55e] backdrop-blur-xl">
          {zoom}
        </div>
        <button
          onClick={() => setZoom(Math.max(10, zoom - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-black/60 text-white backdrop-blur-xl transition-all hover:bg-white/10"
        >
          -
        </button>
      </div>
    </div>
  )
}
