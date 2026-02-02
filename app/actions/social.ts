'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { sendMessage, markAsRead, getMessages } from './message'
import { Database } from '@/types/supabase'

type Profile = Database['public']['Tables']['profiles']['Row']

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

// ... existing code ...

export async function fetchFriends(): Promise<Friend[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  // Fetch accepted friendships
  const { data: rawData, error } = await supabase
    .from('friendships')
    .select(`
      user_id,
      friend_id,
      status,
      friend_profile:profiles!friendships_friend_id_fkey(*),
      user_profile:profiles!friendships_user_id_fkey(*)
    `)
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted')

  if (error) {
    console.error('Error fetching friends:', error)
    return []
  }

  // Cast the result to the expected structure to bypass 'never' inference issues
  // This assumes the query structure matches the interface
  interface FriendshipResult {
    user_id: string
    friend_id: string
    status: string
    friend_profile: Profile | null
    user_profile: Profile | null
  }
  
  const friendships = rawData as unknown as FriendshipResult[]

  // Map to Friend interface
  const friends = friendships.map((f) => {
    const isUserInitiator = f.user_id === user.id
    const friendProfile = isUserInitiator ? f.friend_profile : f.user_profile
    
    if (!friendProfile) return null

    const lastActiveTime = new Date(friendProfile.updated_at).getTime()
    const diffMinutes = (Date.now() - lastActiveTime) / (1000 * 60)
    // If active within last 5 minutes, consider online
    const status = diffMinutes < 5 ? "online" : "offline"

    return {
      id: friendProfile.id,
      name: friendProfile.nickname || 'Unknown Runner',
      avatar: friendProfile.avatar_url,
      level: friendProfile.level || 1,
      status: status as "online" | "offline" | "running",
      lastActive: diffMinutes < 60 
        ? `${Math.floor(diffMinutes)}分钟前` 
        : diffMinutes < 1440 
          ? `${Math.floor(diffMinutes / 60)}小时前` 
          : new Date(friendProfile.updated_at).toLocaleDateString(),
      lastActiveAt: friendProfile.updated_at,
      hexCount: friendProfile.total_area || 0, 
      totalKm: friendProfile.total_distance_km || 0,
      clan: undefined,
      clanColor: undefined
    }
  }).filter(Boolean) as Friend[]

  return friends
}

export async function searchUsers(query: string): Promise<Friend[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  if (!query || query.length < 2) return []

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('nickname', `%${query}%`)
    .limit(10)

  if (error) return []

  return profiles.map((p) => ({
    id: p.id,
    name: p.nickname || 'Unknown',
    avatar: p.avatar_url,
    level: p.level || 1,
    status: 'offline',
    hexCount: p.total_area || 0,
    totalKm: p.total_distance_km || 0
  }))
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

export async function fetchFriendActivities(): Promise<FriendActivity[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  // Get friends IDs first
  const { data: friendships } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted')

  if (!friendships) return []

  const friendIds = friendships.map((f) => 
    f.user_id === user.id ? f.friend_id : f.user_id
  )

  if (friendIds.length === 0) return []

  // 1. Fetch recent territory captures
  const { data: territoriesData } = await supabase
    .from('territories')
    .select(`
      id,
      captured_at,
      city_id,
      owner_id
    `)
    .in('owner_id', friendIds)
    .order('captured_at', { ascending: false })
    .limit(10)

  const territories = territoriesData as unknown as { id: string, captured_at: string, city_id: string, owner_id: string }[]

  // Fetch profiles for friends manually to avoid complex joins on every table if not set up
  const { data: friendProfiles } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, level')
    .in('id', friendIds)

  const profileMap = new Map((friendProfiles as any[])?.map((p) => [p.id, p]) || [])

  const captureActivities: FriendActivity[] = (territories || []).map((t) => {
    const profile = profileMap.get(t.owner_id)
    return {
      id: `capture-${t.id}`,
      user: {
        name: profile?.nickname || 'Unknown',
        avatar: profile?.avatar_url,
        level: profile?.level || 1,
      },
      type: "capture",
      content: {
        title: "占领了新领地",
        description: "在探索中发现并占领了一块新区域",
        stats: [
          { label: "位置", value: t.city_id || "未知区域" }
        ]
      },
      timestamp: t.captured_at,
      likes: 0,
      comments: 0
    }
  })

  // 2. Fetch recent achievements (if table exists and populated)
  // Assuming user_achievements table exists from migration
  const { data: achievementsData } = await supabase
    .from('user_achievements')
    .select(`
      achievement_id,
      completed_at,
      user_id
    `)
    .in('user_id', friendIds)
    .eq('is_completed', true)
    .order('completed_at', { ascending: false })
    .limit(5)

  const achievements = achievementsData as unknown as { achievement_id: string, completed_at: string, user_id: string }[]

  const achievementActivities: FriendActivity[] = (achievements || []).map((a) => {
    const profile = profileMap.get(a.user_id)
    return {
      id: `ach-${a.achievement_id}-${a.user_id}`,
      user: {
        name: profile?.nickname || 'Unknown',
        avatar: profile?.avatar_url,
        level: profile?.level || 1,
      },
      type: "achievement",
      content: {
        title: "解锁了新成就",
        description: `达成了成就 [${a.achievement_id}]`, // Need a way to get achievement name
        stats: []
      },
      timestamp: a.completed_at,
      likes: 0,
      comments: 0
    }
  })

  // 3. Fetch completed missions
  // Assuming user_missions table
  const { data: missionsData } = await supabase
    .from('user_missions')
    .select(`
      id,
      mission_id,
      updated_at,
      user_id,
      status,
      missions (
        title,
        description,
        reward_experience,
        reward_coins
      )
    `)
    .in('user_id', friendIds)
    .eq('status', 'claimed')
    .order('updated_at', { ascending: false })
    .limit(5)

  interface MissionResult {
    id: string
    mission_id: string
    updated_at: string
    user_id: string
    status: string
    missions: {
      title: string
      description: string
      reward_experience: number
      reward_coins: number
    } | null
  }

  const missions = missionsData as unknown as MissionResult[]

  const missionActivities: FriendActivity[] = (missions || []).map((m) => {
    const profile = profileMap.get(m.user_id)
    const missionTitle = m.missions?.title || '神秘任务'
    const xp = m.missions?.reward_experience || 0
    return {
      id: `mission-${m.id}`,
      user: {
        id: m.user_id,
        name: profile?.nickname || 'Unknown',
        avatar: profile?.avatar_url,
        level: profile?.level || 1,
      },
      type: "challenge", // Reusing challenge type for mission completion
      content: {
        title: "完成了任务",
        description: `完成了 [${missionTitle}]`,
        stats: [
          { label: "奖励", value: `+${xp} XP` }
        ]
      },
      timestamp: m.updated_at,
      likes: 0,
      comments: 0
    }
  })

  // Combine and Sort
  const allActivities = [...captureActivities, ...achievementActivities, ...missionActivities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20)

  return allActivities
}

export interface RecommendedUser {
  id: string
  name: string
  avatar?: string
  level: number
  reason: "nearby" | "similar_level" | "similar_achievement" | "mutual_friends"
  reasonDetail: string
  hexCount: number
  totalKm: number
  distance?: number
  mutualFriends?: number
  clan?: string
  clanColor?: string
}

export async function getRecommendedUsers(): Promise<RecommendedUser[]> {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  // 1. Get all existing friend IDs (accepted or pending) to exclude
  const { data: friendships } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
  
  const excludeIds = new Set<string>()
  excludeIds.add(user.id)
  
  if (friendships) {
    friendships.forEach((f) => {
      excludeIds.add(f.user_id)
      excludeIds.add(f.friend_id)
    })
  }

  // 2. Fetch profiles not in the exclude list
  // We can't pass a huge array to .not('id', 'in', array) if it's too large, but for now it's fine.
  // If the list is empty (new user), we just fetch randoms.
  
  let query = supabase
    .from('profiles')
    .select('*')
    .limit(20) // Fetch a bit more to filter/randomize
  
  if (excludeIds.size > 0) {
    query = query.not('id', 'in', `(${Array.from(excludeIds).join(',')})`)
  } else {
    query = query.neq('id', user.id)
  }

  const { data: profiles, error } = await query

  if (error) {
    console.error('Error fetching recommended users:', error)
    return []
  }

  // 3. Map to RecommendedUser
  const recommended: RecommendedUser[] = profiles.map((p) => {
    // Determine a "reason"
    // For now, we simulate reasons based on data
    const reasons: RecommendedUser['reason'][] = ["nearby", "similar_level", "similar_achievement"]
    const randomReason = reasons[Math.floor(Math.random() * reasons.length)]
    
    let reasonDetail = "附近的跑者"
    if (randomReason === "similar_level") reasonDetail = "等级相近"
    if (randomReason === "similar_achievement") reasonDetail = "活跃度相似"

    return {
      id: p.id,
      name: p.nickname || 'Unknown Runner',
      avatar: p.avatar_url,
      level: p.level || 1,
      reason: randomReason,
      reasonDetail: reasonDetail,
      hexCount: 0, // TODO: real stats
      totalKm: 0, // TODO: real stats
      clan: undefined,
      clanColor: undefined
    }
  })

  return recommended.slice(0, 10)
}

export async function sendFriendRequest(targetUserId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  // Check if friendship already exists (in either direction)
  const { data: existing } = await supabase
    .from('friendships')
    .select('*')
    .or(`and(user_id.eq.${user.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${user.id})`)
    .single()

  if (existing) {
    if (existing.status === 'pending') {
      return { success: false, message: 'Friend request already pending' }
    }
    if (existing.status === 'accepted') {
      return { success: false, message: 'Already friends' }
    }
    // If rejected, maybe allow re-request? For now, prevent spam.
    return { success: false, message: 'Cannot send request' }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({
      user_id: user.id,
      friend_id: targetUserId,
      status: 'pending'
    })

  if (error) {
    console.error('Error sending friend request:', error)
    throw new Error('Failed to send friend request')
  }

  return { success: true }
}

export async function getFriendRequests() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  // Incoming requests: user is the friend_id
  const { data: requestsData } = await supabase
    .from('friendships')
    .select(`
      id,
      user_id,
      created_at,
      profile:profiles!friendships_user_id_fkey(*)
    `)
    .eq('friend_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  interface FriendRequestRow {
    id: string
    user_id: string
    created_at: string
    profile: Profile | null
  }
  
  const requests = requestsData as unknown as FriendRequestRow[]

  return (requests || []).map((r) => ({
    id: r.id, // friendship record id (if it exists) or use user_id
    userId: r.user_id,
    name: r.profile?.nickname || 'Unknown',
    avatar: r.profile?.avatar_url,
    level: r.profile?.level || 1,
    timestamp: r.created_at
  }))
}

export async function respondToFriendRequest(userId: string, action: 'accept' | 'reject') {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  if (action === 'accept') {
    // Update status to accepted
    // We need to find the specific record where friend_id is current user and user_id is the requester
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('user_id', userId)
      .eq('friend_id', user.id)

    if (error) throw error
  } else {
    // Delete the record for reject
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('user_id', userId)
      .eq('friend_id', user.id)

    if (error) throw error
  }

  return { success: true }
}

// Challenge System Implementation

export async function createChallenge(params: {
  targetId: string
  type: string
  distance?: number
  duration?: string
  rewardXp?: number
}) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')

  // Create a message representing the challenge
  const challengeContent = JSON.stringify({
    type: params.type,
    distance: params.distance,
    duration: params.duration,
    rewardXp: params.rewardXp,
    createdAt: new Date().toISOString()
  })

  const { error } = await supabase
    .from('messages')
    .insert({
      sender_id: user.id,
      receiver_id: params.targetId,
      type: 'challenge',
      content: challengeContent,
      is_read: false
    })

  if (error) {
    console.error('Create challenge error:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function getPendingChallenges() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data: messages } = await supabase
    .from('messages')
    .select(`
      id,
      content,
      created_at,
      sender:profiles!sender_id(*)
    `)
    .eq('receiver_id', user.id)
    .eq('type', 'challenge')
    .eq('is_read', false) 
    .order('created_at', { ascending: false })

  if (!messages) return []

  return messages.map((m) => {
    let details = {}
    try {
      details = JSON.parse(m.content)
    } catch (e) {
      details = { title: m.content }
    }

    // Calculate expiration
    const created = new Date(m.created_at)
    const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000) // 24 hours
    const now = new Date()
    const diffHours = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60)))
    const expiresIn = `${diffHours}h`
    
    // Type guard or safe access for sender
    // The query returns sender as an object because of the relationship
    const sender = m.sender as unknown as Profile | null

    return {
      id: m.id,
      from: {
        name: sender?.nickname || 'Unknown',
        level: sender?.level || 1,
        avatar: sender?.avatar_url
      },
      ...details,
      expiresIn
    }
  })
}

export async function respondToChallenge(challengeId: string, accept: boolean) {
   const cookieStore = await cookies()
   const supabase = createClient(cookieStore)
   
   // Mark message as read (handled)
   const { error } = await supabase
     .from('messages')
     .update({ is_read: true })
     .eq('id', challengeId)

   if (error) return { success: false, error: error.message }
   
   return { success: true }
}
