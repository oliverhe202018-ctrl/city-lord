"use client"

import { useState, useEffect } from "react"
import { claimTerritory, getCapturedCellsLocal } from "@/services/mock-api"
import { useGameActions } from "@/store/useGameStore"
import { toast } from "@/hooks/use-toast"
import { useHydration } from "@/hooks/useHydration"

/**
 * useTerritoryCapture Hook
 * 处理领地占领逻辑，包括状态管理、API 调用和更新本地存储
 */
export function useTerritoryCapture() {
  const [isCapturing, setIsCapturing] = useState(false)
  const [capturedCells, setCapturedCells] = useState<string[]>([])
  const isHydrated = useHydration()

  useEffect(() => {
    if (isHydrated) {
      try {
        setCapturedCells(getCapturedCellsLocal())
      } catch {
        setCapturedCells([])
      }
    }
  }, [isHydrated])

  // 使用 stable selector 避免不必要的重新渲染
  const { addExperience, addTotalArea, consumeStamina } = useGameActions()

  /**
   * 占领格子
   * @param cellId 六边形格子 ID
   * @param staminaCost 占领所需的体力消耗
   */
  const captureTerritory = async (cellId: string, staminaCost: number = 5) => {
    // 检查是否已经占领过
    if (capturedCells.includes(cellId)) {
      toast({
        title: "已占领",
        description: "该格子已经被您占领了",
        variant: "default",
      })
      return { success: false, alreadyCaptured: true }
    }

    setIsCapturing(true)

    try {
      // 调用 Mock API 占领格子
      const result = await claimTerritory(cellId)

      if (result.success) {
        // 更新本地状态
        setCapturedCells((prev) => [...prev, cellId])

        // 更新游戏状态（通过 Zustand store 自动持久化）
        addExperience(result.experience)
        addTotalArea(result.area)
        consumeStamina(staminaCost)

        toast({
          title: "领地占领成功！",
          description: `获得 ${result.experience} 经验，+${result.area} 面积`,
          variant: "default",
        })

        return { success: true, alreadyCaptured: false, result }
      }
    } catch (error) {
      console.error("Failed to capture territory:", error)
      toast({
        title: "占领失败",
        description: error instanceof Error ? error.message : "请稍后再试",
        variant: "destructive",
      })
      return { success: false, alreadyCaptured: false, error }
    } finally {
      setIsCapturing(false)
    }

    return { success: false, alreadyCaptured: false }
  }

  /**
   * 检查格子是否已占领
   */
  const isCaptured = (cellId: string) => {
    return capturedCells.includes(cellId)
  }

  /**
   * 获取已占领的格子数量
   */
  const getCapturedCount = () => {
    return capturedCells.length
  }

  /**
   * 重置已占领的格子（仅用于测试）
   */
  const resetCapturedCells = () => {
    setCapturedCells([])
    localStorage.removeItem("capturedCells")
    toast({
      title: "已重置",
      description: "已清除所有占领记录",
      variant: "default",
    })
  }

  return {
    isCapturing,
    capturedCells,
    captureTerritory,
    isCaptured,
    getCapturedCount,
    resetCapturedCells,
  }
}
