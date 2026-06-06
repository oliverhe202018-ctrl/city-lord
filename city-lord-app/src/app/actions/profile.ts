import { rpcCall } from '@/api/client';

export const getBackgrounds = async (...args: any[]) => rpcCall('profile', 'getBackgrounds', args);
export const updateProfileBackground = async (...args: any[]) => rpcCall('profile', 'updateProfileBackground', args);
export const toggleProfilePrivacy = async (...args: any[]) => rpcCall('profile', 'toggleProfilePrivacy', args);
export const getRuns = async (...args: any[]) => rpcCall('profile', 'getRuns', args);
export type RunRecord = any;
