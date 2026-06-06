import { rpcCall } from '@/api/client';

export const getStoreItems = async (...args: any[]) => rpcCall('redemption', 'getStoreItems', args);
