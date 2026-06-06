import { rpcCall } from '@/api/client';

export const buyStoreItem = async (...args: any[]) => rpcCall('store', 'buyStoreItem', args);
