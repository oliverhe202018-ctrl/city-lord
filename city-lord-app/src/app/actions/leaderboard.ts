import { rpcCall } from '@/api/client';

export const getActivityLeaderboard = async (...args: any[]) => rpcCall('leaderboard', 'getActivityLeaderboard', args);
export type LeaderboardEntry = any;
export const getSocialLeaderboard = async (...args: any[]) => rpcCall('leaderboard', 'getSocialLeaderboard', args);
