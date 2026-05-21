'use server';

import { getUserMissions, claimMissionReward } from '@/lib/game-logic/mission-service';
import { createClient } from '@/lib/supabase/server';

export interface MissionDto {
  id: string;
  title: string;
  description: string | null;
  type: string;
  frequency: string | null;
  targetValue: number;
  progress: number;
  status: string | null;
  rewardCoins: number;
  rewardXp: number;
  periodKey: string;
  claimedAt: Date | null;
  percent: number;
}

export async function getMissions(): Promise<MissionDto[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  return getUserMissions(user.id);
}

export async function claimReward(missionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHORIZED' };

  return claimMissionReward(user.id, missionId);
}

// 兼容旧导入名，防止消费文件报错
export const fetchUserMissions = getMissions;

export async function claimMissionRewardAction(missionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'UNAUTHORIZED' };

  return claimMissionReward(user.id, missionId);
}

// 批量领取所有任务奖励
export async function claimAllMissions(missionIds: string[]): Promise<{ success: boolean; results: unknown[] }> {
  const results = []
  for (const missionId of missionIds) {
    const result = await claimReward(missionId)
    results.push(result)
  }
  return { success: true, results }
}
