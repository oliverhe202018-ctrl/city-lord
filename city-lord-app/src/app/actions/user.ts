import { rpcCall } from '@/api/client';

export const touchUserActivity = async (...args: any[]) => rpcCall('user', 'touchUserActivity', args);
