import { rpcCall } from '@/api/client';

export const getTerritoryDetail = async (...args: any[]) => rpcCall('territory-detail', 'getTerritoryDetail', args);
