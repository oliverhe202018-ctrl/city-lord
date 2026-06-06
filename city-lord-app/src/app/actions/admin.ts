import { rpcCall } from '@/api/client';

export const getAdminRooms = async (...args: any[]) => rpcCall('admin', 'getAdminRooms', args);
export const getAdminUsers = async (...args: any[]) => rpcCall('admin', 'getAdminUsers', args);
export const toggleUserAntiCheatBypass = async (...args: any[]) => rpcCall('admin', 'toggleUserAntiCheatBypass', args);
export const toggleUserActiveStatus = async (...args: any[]) => rpcCall('admin', 'toggleUserActiveStatus', args);
