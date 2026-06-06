import { rpcCall } from '@/api/client';

export const checkRunEndAchievements = async (...args: any[]) => rpcCall('check-achievements', 'checkRunEndAchievements', args);
export type RunEndAchievementPayload = any;
