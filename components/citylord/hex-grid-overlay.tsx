"use client"

import React from "react"

import { useState, useMemo, useEffect } from "react"
import { Crosshair, Eye, Shield, Swords } from "lucide-react"

type HexState = "unexplored" | "mine" | "enemy" | "neutral" | "contested"

interface HexCell {
  id: number
  x: number
  y: number
  state: HexState
  captureProgress?: number
}

interface HexGridOverlayProps {
  rows?: number
  cols?: number
  hexSize?: number
  showLegend?: boolean
  targetHex?: number | null
  onHexClick?: (hex: HexCell) => void
}

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

function generateHexGrid(rows: number, cols: number): HexCell[] {
  const hexes: HexCell[] = []
  let id = 0
  
  const states: HexState[] = ["mine", "enemy", "neutral", "unexplored", "contested"]
  const weights = [0.2, 0.15, 0.25, 0.35, 0.05]
  
  const getRandomState = (): HexState => {
    const rand = Math.random()
    let cumulative = 0
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i]
      if (rand < cumulative) return states[i]
    }
    return "neutral"
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const state = getRandomState()
      hexes.push({
        id: id++,
        x: col,
        y: row,
        state,
        captureProgress: state === "contested" ? Math.floor(Math.random() * 100) : undefined,
      })
    }
  }
  return hexes
}

export function HexGridOverlay({
  rows = 10,
  cols = 7,
  hexSize = 32,
  showLegend = true,
  targetHex = null,
  onHexClick,
}: HexGridOverlayProps) {
  const [hexes, setHexes] = useState<HexCell[]>([])
  const [selectedHex, setSelectedHex] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  // 只在客户端挂载后生成随机数据，避免 SSR 水合错误
  useEffect(() => {
    setMounted(true)
    setHexes(generateHexGrid(rows, cols))
  }, [rows, cols])

  const hexWidth = hexSize * 2
  const hexHeight = Math.sqrt(3) * hexSize
  const svgWidth = cols * hexWidth * 0.75 + hexSize
  const svgHeight = rows * hexHeight + hexHeight / 2

  const handleHexClick = (hex: HexCell) => {
    setSelectedHex(hex.id)
    onHexClick?.(hex)
  }

  const getHexPoints = (xPos: number, yPos: number) => {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i + Math.PI / 6
      return `${xPos + hexSize * Math.cos(angle)},${yPos + hexSize * Math.sin(angle)}`
    }).join(" ")
  }

  const stateCounts = useMemo(() => {
    const counts: Record<HexState, number> = {
      unexplored: 0,
      mine: 0,
      enemy: 0,
      neutral: 0,
      contested: 0,
    }
    for (const hex of hexes) {
      counts[hex.state]++
    }
    return counts
  }, [hexes])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Fog of War Overlay - Gradient edges */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(15,23,42,0.8)_70%,rgba(15,23,42,0.95)_100%)]" />
      </div>

      {/* SVG Hex Grid */}
      <svg 
        className="h-full w-full"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Glow filters */}
          <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-yellow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Target animation */}
          <radialGradient id="target-gradient">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </radialGradient>
        </defs>

        {hexes.map((hex) => {
          const xPos = hex.x * hexWidth * 0.75 + hexSize + 10
          const yPos = hex.y * hexHeight + (hex.x % 2 === 1 ? hexHeight / 2 : 0) + hexSize
          const config = stateConfig[hex.state]
          const isTarget = hex.id === targetHex
          const isSelected = hex.id === selectedHex

          const getFilter = () => {
            if (hex.state === "mine") return "url(#glow-green)"
            if (hex.state === "enemy") return "url(#glow-red)"
            if (hex.state === "contested") return "url(#glow-yellow)"
            return undefined
          }

          return (
            <g key={hex.id} onClick={() => handleHexClick(hex)} className="cursor-pointer">
              {/* Target pulse animation */}
              {isTarget && (
                <circle
                  cx={xPos}
                  cy={yPos}
                  r={hexSize * 1.5}
                  fill="url(#target-gradient)"
                  className="animate-ping"
                  style={{ animationDuration: "2s" }}
                />
              )}
              
              {/* Selection ring */}
              {isSelected && (
                <polygon
                  points={getHexPoints(xPos, yPos)}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeDasharray="8 4"
                  className="animate-pulse"
                />
              )}

              {/* Main hex */}
              <polygon
                points={getHexPoints(xPos, yPos)}
                fill={config.fill}
                stroke={config.stroke}
                strokeWidth={isSelected ? "2.5" : "1.5"}
                filter={getFilter()}
                className="transition-all duration-200 hover:brightness-125"
              />

              {/* Capture progress indicator for contested hexes */}
              {hex.state === "contested" && hex.captureProgress !== undefined && (
                <text
                  x={xPos}
                  y={yPos + 4}
                  textAnchor="middle"
                  className="fill-yellow-400 text-[10px] font-bold"
                >
                  {hex.captureProgress}%
                </text>
              )}

              {/* Target marker */}
              {isTarget && (
                <text
                  x={xPos}
                  y={yPos + 4}
                  textAnchor="middle"
                  className="fill-[#22c55e] text-xs font-bold"
                >
                  +50
                </text>
              )}
            </g>
          )
        })}

        {/* Recommended path line */}
        {targetHex !== null && (
          <line
            x1={svgWidth / 2}
            y1={svgHeight - 50}
            x2={svgWidth / 2}
            y2={100}
            stroke="#fbbf24"
            strokeWidth="3"
            strokeDasharray="10 5"
            className="animate-pulse"
            opacity="0.6"
          />
        )}
      </svg>

      {/* Legend */}
      {showLegend && (
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <div className="rounded-2xl border border-white/10 bg-black/70 p-3 backdrop-blur-xl">
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
