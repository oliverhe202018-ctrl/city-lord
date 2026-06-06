
export interface ClubMember {
  id: string;
  name: string;
  avatarUrl: string;
  isOnline: boolean;
  contribution?: string | number;
  totalDistance?: string | number;
}

export interface Club {
  id: string;
  name: string; // This will be dynamically generated
  memberCount: number;
  members: ClubMember[];
  territory: number;
}

export const mockClub: Club = {
  id: 'club-123',
  name: '北京市朝阳区跑步俱乐部', // Placeholder name
  memberCount: 24,
  members: [
    { id: 'user-1', name: '风一样的男子', avatarUrl: '/avatars/avatar-1.png', isOnline: true },
    { id: 'user-2', name: '追风少女', avatarUrl: '/avatars/avatar-2.png', isOnline: true },
    { id: 'user-3', name: '奔跑的蜗牛', avatarUrl: '/avatars/avatar-3.png', isOnline: false },
    { id: 'user-4', name: '长跑健将', avatarUrl: '/avatars/avatar-4.png', isOnline: true },
    { id: 'user-5', name: '夜跑达人', avatarUrl: '/avatars/avatar-5.png', isOnline: false },
    { id: 'user-6', name: 'JustRun', avatarUrl: '/avatars/avatar-6.png', isOnline: true },
  ],
  territory: 15.4,
};
