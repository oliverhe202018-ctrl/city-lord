import { rpcCall } from '@/api/client';

export const getUnreadNotificationCount = async (...args: any[]) => rpcCall('notification', 'getUnreadNotificationCount', args);
