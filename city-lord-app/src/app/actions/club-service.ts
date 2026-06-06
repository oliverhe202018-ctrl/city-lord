import { rpcCall } from '@/api/client';

export const getUserTopTerritories = async (...args: any[]) => rpcCall('club-service', 'getUserTopTerritories', args);
