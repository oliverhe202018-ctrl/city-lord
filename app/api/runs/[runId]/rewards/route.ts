import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RewardData {
  leveledUp: boolean
  newLevel: number
  rewardSummary: {
    totalPoints: number
    totalLevelXp: number
    maxAreaMultiplier: number
  }
  reward_coins: number
  reward_xp: number
  reward_territories: number
}

interface ApiResponse {
  status: 'PENDING' | 'COMPLETED' | 'ERROR'
  data?: RewardData
  error?: string
}

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const { runId } = params

    if (!runId) {
      return NextResponse.json<ApiResponse>({
        status: 'ERROR',
        error: 'Run ID is required'
      }, { status: 400 })
    }

    const run = await prisma.runs.findUnique({
      where: { id: runId },
      select: {
        reward_status: true,
        reward_data: true,
        reward_coins: true,
        reward_xp: true,
        reward_territories: true
      }
    })

    if (!run) {
      return NextResponse.json<ApiResponse>({
        status: 'ERROR',
        error: 'Run not found'
      }, { status: 404 })
    }

    const response: ApiResponse = {
      status: run.reward_status as 'PENDING' | 'COMPLETED' | 'ERROR'
    }

    if (run.reward_status === 'COMPLETED' && run.reward_data) {
      response.data = {
        ...(run.reward_data as RewardData),
        reward_coins: run.reward_coins || 0,
        reward_xp: run.reward_xp || 0,
        reward_territories: run.reward_territories || 0
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching run rewards:', error)
    return NextResponse.json<ApiResponse>({
      status: 'ERROR',
      error: 'Internal server error'
    }, { status: 500 })
  }
}