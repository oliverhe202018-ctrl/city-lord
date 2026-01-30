/**
 * Mock API Service
 * 模拟后端接口服务，包含城市数据加载和领地占领功能
 */

import { getCityById } from "@/lib/mock-data"
import type { City } from "@/types/city"

/**
 * Mock 排行榜数据类型
 */
export interface LeaderboardEntry {
  rank: number
  userId: string
  nickname: string
  level: number
  avatar: string
  totalArea: number
  tilesCaptured: number
  reputation: number
}

/**
 * 城市数据响应类型
 */
export interface CityDataResponse {
  city: City
  leaderboard: LeaderboardEntry[]
  totalPlayers: number
}

/**
 * 领地占领响应类型
 */
export interface ClaimTerritoryResponse {
  success: boolean
  cellId: string
  capturedAt: string
  experience: number
  area: number
}

/**
 * 模拟网络延迟的辅助函数
 */
function simulateNetworkDelay(minMs: number = 300, maxMs: number = 800): Promise<void> {
  const delay = Math.random() * (maxMs - minMs) + minMs
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * 模拟生成排行榜数据
 */
function generateMockLeaderboard(cityId: string, count: number = 50): LeaderboardEntry[] {
  const leaderboard: LeaderboardEntry[] = []

  for (let i = 0; i < count; i++) {
    const isTopPlayer = i < 3
    leaderboard.push({
      rank: i + 1,
      userId: `player_${i + 1}`,
      nickname: isTopPlayer
        ? [`征服者`, `暗影猎人`, `疾风跑者`][i]
        : `玩家${i + 1}`,
      level: Math.max(1, Math.floor(50 - i * 0.8)),
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cityId}_player_${i}`,
      totalArea: Math.floor(100000 - i * 1800),
      tilesCaptured: Math.floor(50000 - i * 900),
      reputation: Math.floor(100000 - i * 1900),
    })
  }

  return leaderboard
}

/**
 * 模拟从后端获取城市配置和排行榜数据
 * @param cityId 城市 ID
 * @returns Promise<CityDataResponse> 城市数据和排行榜
 */
export async function fetchCityData(cityId: string): Promise<CityDataResponse> {
  // 模拟网络请求延迟
  await simulateNetworkDelay(400, 900)

  // 获取城市基本信息
  const city = getCityById(cityId)
  if (!city) {
    throw new Error(`City with id ${cityId} not found`)
  }

  // 生成模拟排行榜数据
  const leaderboard = generateMockLeaderboard(cityId, 50)
  const totalPlayers = city.stats.activePlayers

  console.log(`[Mock API] Fetched city data for ${cityId}:`, {
    city: city.name,
    leaderboardSize: leaderboard.length,
    totalPlayers,
  })

  return {
    city,
    leaderboard,
    totalPlayers,
  }
}

/**
 * 模拟领地占领请求
 * @param cellId 六边形格子 ID
 * @returns Promise<ClaimTerritoryResponse> 占领结果
 */
export async function claimTerritory(cellId: string): Promise<ClaimTerritoryResponse> {
  console.log(`[Mock API] Claiming territory: ${cellId}`)

  // 模拟网络请求延迟 (500ms)
  await simulateNetworkDelay(400, 600)

  // 模拟占领成功 (90% 成功率)
  const isSuccess = Math.random() < 0.9

  if (!isSuccess) {
    throw new Error("Failed to claim territory. Please try again.")
  }

  // 随机生成奖励
  const experience = Math.floor(Math.random() * 50) + 10 // 10-60 经验
  const area = Math.floor(Math.random() * 20) + 5 // 5-25 面积

  const response: ClaimTerritoryResponse = {
    success: true,
    cellId,
    capturedAt: new Date().toISOString(),
    experience,
    area,
  }

  console.log(`[Mock API] Territory claimed successfully:`, response)

  // 更新本地 CapturedCells 数据
  updateCapturedCellsLocal(cellId)

  return response
}

/**
 * 更新本地的 CapturedCells 数据
 * @param cellId 六边形格子 ID
 */
function updateCapturedCellsLocal(cellId: string): void {
  try {
    // 从 LocalStorage 读取现有数据
    const capturedCellsKey = "capturedCells"
    const existingData = localStorage.getItem(capturedCellsKey)

    let capturedCells: string[] = []

    if (existingData) {
      try {
        capturedCells = JSON.parse(existingData)
      } catch (error) {
        console.error("[Mock API] Failed to parse captured cells:", error)
      }
    }

    // 添加新占领的格子（避免重复）
    if (!capturedCells.includes(cellId)) {
      capturedCells.push(cellId)
      localStorage.setItem(capturedCellsKey, JSON.stringify(capturedCells))
      console.log(`[Mock API] Updated captured cells, total: ${capturedCells.length}`)
    }
  } catch (error) {
    console.error("[Mock API] Failed to update captured cells:", error)
  }
}

/**
 * 获取本地已占领的格子列表
 * @returns string[] 已占领的格子 ID 列表
 */
export function getCapturedCellsLocal(): string[] {
  try {
    const capturedCellsKey = "capturedCells"
    const existingData = localStorage.getItem(capturedCellsKey)

    if (existingData) {
      return JSON.parse(existingData)
    }

    return []
  } catch (error) {
    console.error("[Mock API] Failed to get captured cells:", error)
    return []
  }
}

/**
 * 清除本地已占领的格子数据
 * 用于重置游戏进度或测试
 */
export function clearCapturedCellsLocal(): void {
  try {
    localStorage.removeItem("capturedCells")
    console.log("[Mock API] Cleared captured cells")
  } catch (error) {
    console.error("[Mock API] Failed to clear captured cells:", error)
  }
}
