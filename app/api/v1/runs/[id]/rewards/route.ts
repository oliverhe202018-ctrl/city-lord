import { prisma } from '@/lib/prisma'
import { withErrorHandler, successResponse } from '@/lib/api/with-handler'
import { AppError, ErrorCode } from '@/lib/api/errors'

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

export const GET = withErrorHandler(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const { id: runId } = params

  if (!runId) {
    throw new AppError(ErrorCode.REQ_BAD_PARAM, 'Run ID is required');
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
    throw new AppError(ErrorCode.RES_NOT_FOUND, 'Run not found');
  }

  const result: any = {
    status: run.reward_status as 'PENDING' | 'COMPLETED' | 'ERROR'
  }

  if (run.reward_status === 'COMPLETED' && run.reward_data) {
    result.data = {
      ...(run.reward_data as unknown as RewardData),
      reward_coins: run.reward_coins || 0,
      reward_xp: run.reward_xp || 0,
      reward_territories: run.reward_territories || 0
    }
  }

  return successResponse(result)
});
