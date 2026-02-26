export interface FriendRequest {
  id: string
  userId: string
  name: string
  avatar?: string | null
  level: number
  timestamp: string
}

export interface Friend {
  id: string
  name: string
  avatar?: string | null
  level: number
  status: "online" | "running" | "offline"
  lastActive?: string
  lastActiveAt?: string
  hexCount: number
  totalKm: number
  clan?: string
  clanColor?: string
  nearbyDistance?: number
}

export interface FriendActivity {
  id: string
  user: {
    id: string
    name: string
    avatar?: string
    level: number
    clan?: string
  }
  type: "capture" | "run" | "levelup" | "achievement" | "battle" | "challenge"
  content: {
    title: string
    description: string
    stats?: { label: string; value: string }[]
    location?: string
  }
  timestamp: string
  likes: number
  comments: number
  isLiked?: boolean
}

export interface RecommendedUser {
  id: string
  name: string
  avatar?: string
  level: number
  reason: "nearby" | "similar_level" | "similar_achievement" | "mutual_friends" | "similar_runner" | "same_city" | "similar_activity"
  reasonDetail: string
  hexCount: number
  totalKm: number
  distance?: number
  mutualFriends?: number
  clan?: string
  clanColor?: string
}
