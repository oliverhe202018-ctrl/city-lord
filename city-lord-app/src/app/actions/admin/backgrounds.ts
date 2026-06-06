import { rpcCall } from '@/api/client';

export const uploadBackgroundImage = async (...args: any[]) => rpcCall('admin/backgrounds', 'uploadBackgroundImage', args);
export const upsertBackground = async (...args: any[]) => rpcCall('admin/backgrounds', 'upsertBackground', args);
export type BackgroundFormData = any;
export type BackgroundRecord = any;
