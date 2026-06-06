import { rpcCall } from '@/api/client';

export const uploadTrajectoryBatch = async (...args: any[]) => rpcCall('sync', 'uploadTrajectoryBatch', args);
