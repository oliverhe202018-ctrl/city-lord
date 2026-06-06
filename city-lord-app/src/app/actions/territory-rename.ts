import { rpcCall } from '@/api/client';

export const renameTerritory = async (...args: any[]) => rpcCall('territory-rename', 'renameTerritory', args);
