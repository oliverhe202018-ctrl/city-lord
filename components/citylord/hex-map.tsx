"use client"

import { useState } from "react"
import { User, Signal } from "lucide-react"
import { formatAreaFromHexCount } from "@/lib/citylord/area-utils"

interface HexCell {
  id: number
  x: number
  y: number
  owner: "user" | "enemy" | "neutral"
}

function generateHexGrid(): HexCell[] {
  const hexes: HexCell[] = []
  let id = 0
  const rows = 12
  const cols = 8

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const owners: ("user" | "enemy" | "neutral")[] = ["user", "enemy", "neutral", "neutral", "neutral"]
      hexes.push({
        id: id++,
        x: col,
        y: row,
        owner: owners[Math.floor(Math.random() * owners.length)],
      })
    }
  }
  return hexes
}

export function HexMap() {
  const [hexes] = useState<HexCell[]>(generateHexGrid)
  const [isPulsing, setIsPulsing] = useState(true)

  const getHexColor = (owner: string) => {
    switch (owner) {
      case "user":
        return "fill-[#39ff14]/30 stroke-[#39ff14]"
      case "enemy":
        return "fill-red-500/30 stroke-red-500"
      default:
        return "fill-white/5 stroke-white/20"
    }
  }

  const hexSize = 28
  const hexWidth = hexSize * 2
  const hexHeight = Math.sqrt(3) * hexSize

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#1a1a1a]">
      {/* Map Background Pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(57,255,20,0.05)_0%,transparent_50%)]" />
      
      {/* Grid Lines Background */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(57,255,20,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(57,255,20,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Top Left - User Profile */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#39ff14] to-[#39ff14]/50">
          <User className="h-5 w-5 text-black" />
        </div>
        <div>
          <p className="text-xs text-white/60">跑者</p>
          <p className="font-bold text-[#39ff14]">等级 5</p>
        </div>
      </div>

      {/* Top Right - GPS Signal */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 backdrop-blur-xl">
        <Signal className="h-4 w-4 text-[#39ff14]" />
        <span className="text-sm font-medium text-[#39ff14]">GPS: 强</span>
      </div>

      {/* Hexagonal Grid */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="glow-green">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-red">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {hexes.map((hex) => {
          const xPos = hex.x * hexWidth * 0.75 + 50
          const yPos = hex.y * hexHeight + (hex.x % 2 === 1 ? hexHeight / 2 : 0) + 50
          
          const points = Array.from({ length: 6 }, (_, i) => {
            const angle = (Math.PI / 3) * i + Math.PI / 6
            return `${xPos + hexSize * Math.cos(angle)},${yPos + hexSize * Math.sin(angle)}`
          }).join(" ")

          return (
            <polygon
              key={hex.id}
              points={points}
              className={`${getHexColor(hex.owner)} transition-all duration-300`}
              strokeWidth="1.5"
              filter={hex.owner !== "neutral" ? `url(#glow-${hex.owner === "user" ? "green" : "red"})` : undefined}
            />
          )
        })}
      </svg>

      {/* Start Run Button */}
      <div className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2">
        <button
          onClick={() => setIsPulsing(!isPulsing)}
          className="group relative flex h-24 w-24 items-center justify-center"
        >
          {/* Pulse rings */}
          {isPulsing && (
            <>
              <span className="absolute h-full w-full animate-ping rounded-full bg-[#39ff14]/30" style={{ animationDuration: '2s' }} />
              <span className="absolute h-[120%] w-[120%] animate-ping rounded-full bg-[#39ff14]/20" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
            </>
          )}
          {/* Button */}
          <span className="relative flex h-full w-full items-center justify-center rounded-full border-2 border-[#39ff14] bg-[#39ff14]/20 shadow-[0_0_30px_rgba(57,255,20,0.5)] backdrop-blur-sm transition-all group-hover:bg-[#39ff14]/30 group-hover:shadow-[0_0_50px_rgba(57,255,20,0.7)]">
            <span className="text-center text-sm font-bold leading-tight text-[#39ff14]">
              开始
              <br />
              跑步
            </span>
          </span>
        </button>
      </div>

      {/* Territory Stats - Area Display */}
      {(() => {
        const myArea = formatAreaFromHexCount(24)
        const contestedArea = formatAreaFromHexCount(8)
        return (
          <>
            <div className="absolute bottom-28 left-4 z-10 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl">
              <p className="text-xs text-white/60">我的领地</p>
              <p className="text-2xl font-bold text-[#39ff14]">
                {myArea.value} <span className="text-sm font-normal text-white/40">{myArea.unit}</span>
              </p>
            </div>

            <div className="absolute bottom-28 right-4 z-10 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl">
              <p className="text-xs text-white/60">争夺中</p>
              <p className="text-2xl font-bold text-red-500">
                {contestedArea.value} <span className="text-sm font-normal text-white/40">{contestedArea.unit}</span>
              </p>
            </div>
          </>
        )
      })()}
    </div>
  )
}
