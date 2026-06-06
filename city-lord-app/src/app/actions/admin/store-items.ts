import { rpcCall } from '@/api/client';

export const upsertStoreItem = async (...args: any[]) => rpcCall('admin/store-items', 'upsertStoreItem', args);
export const uploadStoreItemImage = async (...args: any[]) => rpcCall('admin/store-items', 'uploadStoreItemImage', args);
export type StoreItemInput = any;
