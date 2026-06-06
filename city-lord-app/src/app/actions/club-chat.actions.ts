import { rpcCall } from '@/api/client';

export const getClubChannels = async (...args: any[]) => rpcCall('club-chat.actions', 'getClubChannels', args);
export const getClubMessages = async (...args: any[]) => rpcCall('club-chat.actions', 'getClubMessages', args);
export const sendClubMessage = async (...args: any[]) => rpcCall('club-chat.actions', 'sendClubMessage', args);
export const getMyClubMembership = async (...args: any[]) => rpcCall('club-chat.actions', 'getMyClubMembership', args);
