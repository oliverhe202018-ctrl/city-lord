import { rpcCall } from '@/api/client';

export const getClubDynamics = async (...args: any[]) => rpcCall('club-dynamics.actions', 'getClubDynamics', args);
export type DynamicItem = any;
