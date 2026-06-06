import { rpcCall } from '@/api/client';

export const getUnreadMessageCount = async (...args: any[]) => rpcCall('message', 'getUnreadMessageCount', args);
