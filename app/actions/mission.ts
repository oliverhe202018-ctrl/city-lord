'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'city' | 'weekly' | 'special';
  icon: string;
  target: number;
  current: number;
  reward: {
    points: number;
    experience: number;
  };
  status: 'todo' | 'in-progress' | 'completed' | 'claimed';
}

export interface ClaimRewardResult {
  success: boolean;
  message: string;
  newStatus?: 'claimed';
}

/**
 * 获取用户的所有任务
 */
export async function getUserMissions() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '未登录' };
  }

  const { data, error } = await supabase
    .from('user_missions')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('获取任务失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true, data: data || [] };
}

/**
 * 领取单个任务奖励
 */
export async function claimMissionReward(missionId: string, taskTitle: string, rewardType: 'xp' | 'coins', rewardAmount: number): Promise<ClaimRewardResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, message: '未登录' };
  }

  try {
    // 2. Perform UPSERT (Insert if new, Update if exists) to ensure persistence
    // This handles cases where the user has the task in frontend (defaults) but not in DB yet.
    const { error: upsertError } = await (supabase
      .from('user_missions') as any)
      .upsert({
        user_id: user.id,
        mission_id: missionId,
        status: 'claimed',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id, mission_id'
      });

    if (upsertError) {
      console.error('Claim UPSERT failed:', upsertError);
      return { success: false, message: '领取失败: ' + upsertError.message };
    }

    return { success: true, message: '领取成功', newStatus: 'claimed' };

  } catch (error: any) {
    console.error('Claim exception:', error);
    return { success: false, message: error.message || '领取失败' };
  }
}

/**
 * 批量领取所有可领取的奖励（一键领取）
 */
export async function claimAllMissionsRewards(tasks: Task[]): Promise<{ success: boolean; claimed: string[]; failed: string[]; message: string }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, claimed: [], failed: [], message: '未登录' };
  }

  const claimed: string[] = [];
  const failed: string[] = [];

  // 筛选出已完成但未领取的任务
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (completedTasks.length === 0) {
    return { success: false, claimed: [], failed: [], message: '没有可领取的奖励' };
  }

  // 循环处理每个任务
  for (const task of completedTasks) {
    try {
      const result = await claimMissionReward(
        task.id,
        task.title,
        'xp', // 假设都是经验奖励
        task.reward.experience
      );

      if (result.success) {
        claimed.push(task.id);
      } else {
        failed.push(task.id);
      }
    } catch (error: any) {
      console.error(`领取任务 ${task.id} 失败:`, error);
      failed.push(task.id);
    }
  }

  const message = claimed.length > 0
    ? `成功领取 ${claimed.length} 个任务的奖励`
    : '没有成功领取的奖励';

  return {
    success: claimed.length > 0,
    claimed,
    failed,
    message
  };
}

/**
 * 更新任务进度
 */
export async function updateMissionProgress(missionId: string, progress: number) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '未登录' };
  }

  const { error } = await (supabase
    .from('user_missions') as any)
    .update({
      progress,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .eq('mission_id', missionId);

  if (error) {
    console.error('更新任务进度失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 完成任务（标记为 completed）
 */
export async function completeMission(missionId: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: '未登录' };
  }

  const { error } = await (supabase
    .from('user_missions') as any)
    .update({
      status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id)
    .eq('mission_id', missionId);

  if (error) {
    console.error('完成任务失败:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
