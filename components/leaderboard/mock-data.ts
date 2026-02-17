
export interface RankData {
  rank: number;
  id?: string; // User ID for navigation
  name: string;
  avatar?: string;
  score: number | string;
  change: 'up' | 'down' | 'same';
  aux?: string; // 辅助信息：所属公会/头衔/省份
  isMe?: boolean;
}

export const PERSONAL_RANK: RankData[] = Array.from({ length: 15 }, (_, i) => ({
  rank: i + 1,
  name: `User_${Math.random().toString(36).substring(7)}`,
  avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
  score: Math.floor(10000 - i * 500 + Math.random() * 100),
  change: i % 3 === 0 ? 'up' : i % 3 === 1 ? 'down' : 'same',
  aux: 'Level ' + (50 - i),
  isMe: i === 12
}));

export const CLUB_LOCAL_RANK: RankData[] = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  name: `Club_Local_${i}`,
  avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=club_${i}`,
  score: Math.floor(50000 - i * 2000),
  change: 'same',
  aux: 'Members: ' + (100 - i * 5)
}));

export const CLUB_NATIONAL_RANK: RankData[] = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  name: `Club_National_${i}`,
  avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=national_${i}`,
  score: Math.floor(100000 - i * 5000),
  change: i < 3 ? 'up' : 'same',
  aux: 'Province ' + String.fromCharCode(65 + i)
}));

export const PROVINCE_RANK: RankData[] = Array.from({ length: 10 }, (_, i) => ({
  rank: i + 1,
  name: ['Beijing', 'Shanghai', 'Guangdong', 'Zhejiang', 'Jiangsu', 'Sichuan', 'Fujian', 'Shandong', 'Hubei', 'Henan'][i] || `Province_${i}`,
  score: Math.floor(1000000 - i * 50000),
  change: 'same',
  aux: 'Total Power'
}));
