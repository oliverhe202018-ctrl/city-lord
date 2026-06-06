import { rpcCall } from '@/api/client';

export const submitTerritoryReport = async (...args: any[]) => rpcCall('territory-report', 'submitTerritoryReport', args);
