import { rpcCall } from '@/api/client';

export const getSocialScoreLeaderboard = async (...args: any[]) => rpcCall('social-service', 'getSocialScoreLeaderboard', args);
