"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { MapPin, CheckCircle, RefreshCw } from "lucide-react"
import { useTerritoryCapture } from "./territory-capture-hook"
import { LoadingSpinner } from "./loading-screen"
import { useGameStore } from "@/store/useGameStore"
import { useHydration } from "@/hooks/useHydration"

/**
 * TerritoryCaptureDemo 组件
 * 演示如何使用 useTerritoryCapture Hook 来占领领地
 */
export function TerritoryCaptureDemo() {
  const { isCapturing, captureTerritory, isCaptured, getCapturedCount } = useTerritoryCapture()
  const { level, totalArea, stamina } = useGameStore()
  const isHydrated = useHydration()

  if (!isHydrated) {
    return (
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#1a1a1a] p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-white/60">加载中...</div>
        </div>
      </div>
    )
  }

  const [selectedCellId, setSelectedCellId] = useState("hex-cell-001")

  // 模拟生成相邻的格子 ID
  const nearbyCells = Array.from({ length: 6 }, (_, i) => `hex-cell-${String(i + 1).padStart(3, "0")}`)

  const handleCapture = async () => {
    if (stamina < 5) {
      alert("体力不足，需要 5 点体力才能占领领地！")
      return
    }

    const result = await captureTerritory(selectedCellId, 5)

    if (result.success) {
      // 占领成功后，自动选择下一个未占领的格子
      const nextCell = nearbyCells.find((id) => !isCaptured(id))
      if (nextCell) {
        setSelectedCellId(nextCell)
      }
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#1a1a1a] p-6">
      <h3 className="text-xl font-bold text-white">领地占领演示</h3>

      {/* 玩家状态 */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>等级 {level}</span>
            <span>•</span>
            <span>已占领 {getCapturedCount()} 个格子</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span>总占领面积 {totalArea} km²</span>
            <span>•</span>
            <span>体力 {stamina}/100</span>
          </div>
        </div>
      </div>

      {/* 六边形网格演示 */}
      <div className="grid grid-cols-3 gap-3">
        {nearbyCells.map((cellId) => {
          const captured = isCaptured(cellId)
          const selected = cellId === selectedCellId

          return (
            <motion.button
              key={cellId}
              onClick={() => setSelectedCellId(cellId)}
              disabled={isCapturing}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                relative flex aspect-square items-center justify-center rounded-xl border-2 transition-all
                ${
                  captured
                    ? "border-[#22c55e] bg-[#22c55e]/20"
                    : selected
                      ? "border-[#3b82f6] bg-[#3b82f6]/20"
                      : "border-white/20 bg-white/5 hover:border-white/40"
                }
                ${isCapturing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {captured ? (
                <CheckCircle className="h-8 w-8 text-[#22c55e]" />
              ) : selected ? (
                <MapPin className="h-8 w-8 text-[#3b82f6]" />
              ) : (
                <span className="text-sm font-bold text-white/40">{cellId.split("-")[2]}</span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* 当前选中的格子信息 */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-4">
        <div>
          <p className="text-sm text-white/60">当前选中</p>
          <p className="font-bold text-white">{selectedCellId}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-white/60">消耗体力</p>
          <p className="font-bold text-white">5 点</p>
        </div>
      </div>

      {/* 占领按钮 */}
      <button
        onClick={handleCapture}
        disabled={isCapturing || isCaptured(selectedCellId)}
        className={`
          w-full rounded-xl py-3 font-bold transition-all
          ${
            isCaptured(selectedCellId)
              ? "cursor-not-allowed bg-white/10 text-white/40"
              : isCapturing
                ? "cursor-not-allowed bg-white/10 text-white/60"
                : "cursor-pointer bg-gradient-to-r from-[#22c55e] to-[#3b82f6] text-white hover:opacity-90"
          }
        `}
      >
        {isCapturing ? (
          <span className="flex items-center justify-center gap-2">
            <LoadingSpinner size="sm" />
            占领中...
          </span>
        ) : isCaptured(selectedCellId) ? (
          <span className="flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5" />
            已占领
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <MapPin className="h-5 w-5" />
            占领领地
          </span>
        )}
      </button>

      {/* 提示信息 */}
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
        <p>💡 点击格子选中，然后点击"占领领地"按钮。每个格子需要消耗 5 点体力。</p>
      </div>
    </div>
  )
}

/**
 * 简单的领地占领示例组件，可以集成到地图中
 */
export function SimpleTerritoryButton({ cellId, onCaptureSuccess }: { cellId: string, onCaptureSuccess?: () => void }) {
  const { isCapturing, captureTerritory, isCaptured } = useTerritoryCapture()

  const handleCapture = async () => {
    const result = await captureTerritory(cellId, 5)
    if (result.success && onCaptureSuccess) {
      onCaptureSuccess()
    }
  }

  return (
    <button
      onClick={handleCapture}
      disabled={isCapturing || isCaptured(cellId)}
      className={`
        rounded-lg px-3 py-1.5 text-sm font-medium transition-all
        ${
          isCaptured(cellId)
            ? "cursor-not-allowed bg-[#22c55e]/20 text-[#22c55e]"
            : isCapturing
              ? "cursor-not-allowed bg-white/10 text-white/60"
              : "cursor-pointer bg-[#3b82f6] text-white hover:bg-[#3b82f6]/80"
        }
      `}
    >
      {isCapturing ? (
        <span className="flex items-center gap-1">
          <LoadingSpinner size="sm" />
          占领中
        </span>
      ) : isCaptured(cellId) ? (
        <span className="flex items-center gap-1">
          <CheckCircle className="h-4 w-4" />
          已占领
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          占领
        </span>
      )}
    </button>
  )
}
