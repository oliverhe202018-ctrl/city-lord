
export interface PublicRoom {
  id: string;
  name: string;
  memberCount: number;
  maxMembers: number;
  distance: number; // in meters
  isPrivate: boolean;
}

// All mock room data has been removed.
// Room data is now fetched from the real API via /api/room/get-rooms.
