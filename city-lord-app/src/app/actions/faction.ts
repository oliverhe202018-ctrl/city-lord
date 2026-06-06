import { rpcCall } from '@/api/client';

export const getFactionLeaderboard = async (...args: any[]) => rpcCall('faction', 'getFactionLeaderboard', args);
export type FactionLeaderboardEntry = any;
