import { rpcCall } from '@/api/client';

export const getAccountInfo = async (...args: any[]) => rpcCall('account', 'getAccountInfo', args);
