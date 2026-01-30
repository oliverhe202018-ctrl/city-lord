
export interface PublicRoom {
  id: string;
  name: string;
  memberCount: number;
  maxMembers: number;
  distance: number; // in meters
  isPrivate: boolean;
}

export const mockPublicRooms: PublicRoom[] = [
  {
    id: 'room-1',
    name: '朝阳公园欢乐跑',
    memberCount: 3,
    maxMembers: 10,
    distance: 800,
    isPrivate: false,
  },
  {
    id: 'room-2',
    name: '奥森北园10公里挑战',
    memberCount: 8,
    maxMembers: 10,
    distance: 1200,
    isPrivate: false,
  },
  {
    id: 'room-3',
    name: '亮马河夜跑小队',
    memberCount: 5,
    maxMembers: 8,
    distance: 2500,
    isPrivate: true,
  },
  {
    id: 'room-4',
    name: '周末长距离训练',
    memberCount: 1,
    maxMembers: 5,
    distance: 5000,
    isPrivate: false,
  },
];
