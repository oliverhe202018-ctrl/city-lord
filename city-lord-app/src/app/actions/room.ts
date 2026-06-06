import { rpcCall } from '@/api/client';

export const fetchRoomTerritoryEvents = async (...args: any[]) => rpcCall('room', 'fetchRoomTerritoryEvents', args);
