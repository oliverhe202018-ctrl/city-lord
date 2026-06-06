import { rpcCall } from '@/api/client';

export const getRunSettlementStatus = async (...args: any[]) => rpcCall('run-service', 'getRunSettlementStatus', args);
export const getTerritoriesByRunId = async (...args: any[]) => rpcCall('run-service', 'getTerritoriesByRunId', args);
export const updateRunSummary = async (...args: any[]) => rpcCall('run-service', 'updateRunSummary', args);
export const saveRunActivity = async (...args: any[]) => rpcCall('run-service', 'saveRunActivity', args);
