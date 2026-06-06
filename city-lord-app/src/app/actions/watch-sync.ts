import { rpcCall } from '@/api/client';

export const syncWatchRunData = async (...args: any[]) => rpcCall('watch-sync', 'syncWatchRunData', args);
