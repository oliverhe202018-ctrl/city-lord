import { rpcCall } from '@/api/client';

export const approveClub = async (...args: any[]) => rpcCall('club', 'approveClub', args);
export const rejectClub = async (...args: any[]) => rpcCall('club', 'rejectClub', args);
export const getApprovedClubs = async (...args: any[]) => rpcCall('club', 'getApprovedClubs', args);
export const getPendingClubs = async (...args: any[]) => rpcCall('club', 'getPendingClubs', args);
export type ApprovedClubDTO = any;
export type PendingClubDTO = any;
