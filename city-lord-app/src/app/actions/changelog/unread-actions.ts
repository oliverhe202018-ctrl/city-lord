import { rpcCall } from '@/api/client';

export const getUnreadVersions = async (...args: any[]) => rpcCall('changelog/unread-actions', 'getUnreadVersions', args);
export const markVersionsAsRead = async (...args: any[]) => rpcCall('changelog/unread-actions', 'markVersionsAsRead', args);
export type UnreadVersion = any;
export const markVersionAsRead = async (...args: any[]) => rpcCall('changelog/unread-actions', 'markVersionAsRead', args);
