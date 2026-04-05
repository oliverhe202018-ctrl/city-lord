
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

// All mock data arrays have been removed.
// Leaderboard data is now fetched from the real API via getLeaderboardData().
