'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { Database } from '@/types/supabase'

type ClubRow = Database['public']['Tables']['clubs']['Row']
type ClubMemberRow = Database['public']['Tables']['club_members']['Row']
type ProfileRow = Database['public']['Tables']['profiles']['Row']

export type Club = {
  id: string
  name: string
  description: string | null
  owner_id: string | null
  avatar_url: string | null
  level: string
  rating: number
  member_count: number
  territory: string
  created_at: string
}

export type ClubMember = {
  club_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'active'
  joined_at: string
}

export async function createClub(data: { name: string; description?: string; avatar_url?: string }) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    let userId = authUser?.id

    // Fallback to first profile if no auth user (Dev/Demo mode)
    if (!userId) {
      const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
      if (profiles && profiles.length > 0) {
        userId = profiles[0].id
      }
    }

    if (!userId) {
        return { success: false, error: 'Unauthorized: User not found' }
    }

    // Prepare insert data based on actual schema
    const insertData = {
      name: data.name,
      description: data.description || null,
      owner_id: userId,
      avatar_url: data.avatar_url || null, 
      level: '1', // Default level
      rating: 0,
      member_count: 1,
      territory: '0'
    }

    const { data: club, error } = await supabase
      .from('clubs')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Database Error [createClub]:', JSON.stringify(error, null, 2))
      return { success: false, error: error.message || 'Failed to create club' }
    }

    const clubAny = club as any;

    // Automatically join the club as owner
    const { error: joinError } = await supabase
        .from('club_members')
        .insert({
            club_id: clubAny.id,
            user_id: userId,
            role: 'owner',
            status: 'active'
        })
    
    if (joinError) {
        console.error('Database Error [createClub -> join]:', joinError)
        // Note: Club created but join failed. In real app, might want to rollback or handle.
    }

    return {
      success: true,
      data: {
        ...clubAny,
        level: clubAny.level || '初级',
        rating: clubAny.rating || 5.0,
        member_count: clubAny.member_count || 1,
        territory: clubAny.territory || '0 mi²'
      }
    }
  } catch (err) {
    console.error('Create Club Exception:', err)
    // Ensure we return a structured error instead of throwing to avoid Server Component Render Error
    return { success: false, error: err instanceof Error ? err.message : 'Unknown server error' }
  }
}

export async function updateClub(clubId: string, data: Partial<Club>) {
    try {
        const cookieStore = await cookies()
        const supabase = createClient(cookieStore)
        
        // Map frontend Club type to DB columns if needed
        const updateData: any = { ...data }
        // Remove fields that shouldn't be updated directly or don't exist
        delete updateData.member_count
        delete updateData.territory
        
        const { error } = await supabase
            .from('clubs')
            .update(updateData)
            .eq('id', clubId)
            
        if (error) {
             console.error('Update Club Error:', error)
             return { success: false, error: error.message }
        }
        return { success: true }
    } catch (e) {
        return { success: false, error: 'Failed to update club' }
    }
}

export async function getClubs() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('clubs')
    .select(`
      *,
      club_members (count)
    `)
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching clubs:', error)
    return []
  }

  interface ClubResult {
    id: string
    name: string
    description: string | null
    owner_id: string | null
    avatar_url: string | null
    level: string
    rating: number
    member_count: number
    territory: string
    created_at: string
    club_members: { count: number }[] | null
  }

  const typedData = data as unknown as ClubResult[]

  // Get user memberships if logged in
  const userMemberships = new Set<string>()
  if (user) {
      const { data: memberships } = await supabase
          .from('club_members')
          .select('club_id')
          .eq('user_id', user.id)
      
      if (memberships) {
          memberships.forEach((m) => userMemberships.add(m.club_id))
      }
  }
  
  return typedData.map((club) => ({
    id: club.id,
    name: club.name,
    description: club.description,
    owner_id: club.owner_id,
    avatar: club.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${club.id}`,
    members: club.club_members?.[0]?.count || 0,
    territory: club.territory || '0 mi²', 
    level: club.level || '初级', 
    rating: club.rating || 5.0, 
    isJoined: userMemberships.has(club.id)
  }))
}

export async function joinClub(clubId: string) {
  try {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }
    
    // 1. 检查是否已经加入
    const { data: existing, error: checkError } = await supabase
        .from('club_members')
        .select('status')
        .eq('club_id', clubId)
        .eq('user_id', user.id)
        .single()
        
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "No rows found"
        return { success: false, error: 'Failed to check membership status' }
    }
        
    if (existing) {
        if (existing.status === 'pending') return { success: false, error: '申请审核中' }
        if (existing.status === 'active') return { success: false, error: '已加入该俱乐部' }
    }
    
    // 2. 插入申请记录 (status = pending)
    const { error } = await supabase
        .from('club_members')
        .insert({
        club_id: clubId,
        user_id: user.id,
        role: 'member',
        status: 'pending'
        })
        
    if (error) {
        console.error('Join Club Error:', error)
        return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err) {
      console.error('Join Club Exception:', err)
      return { success: false, error: 'Failed to join club' }
  }
}

export async function leaveClub(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Check if owner
  const { data: club } = await supabase
    .from('clubs')
    .select('owner_id')
    .eq('id', clubId)
    .single()

  if (club && club.owner_id === user.id) {
    throw new Error('会长无法退出俱乐部，请先转让会长或解散俱乐部')
  }

  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('user_id', user.id)

  if (error) throw error
  
  return { success: true }
}

// ==================== Helper ====================

async function checkClubOwner(supabase: any, clubId: string, userId: string) {
  const { data: club, error } = await supabase
    .from('clubs')
    .select('owner_id')
    .eq('id', clubId)
    .single()
    
  if (error || !club) return false
  return (club as any).owner_id === userId
}

// ==================== New Management Actions ====================

export async function updateClubInfo(clubId: string, data: { name?: string, description?: string, avatarUrl?: string }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未登录' }
  
  // 2. 验证俱乐部权限 (仅会长)
  const { data: club } = await supabase
    .from('clubs')
    .select('owner_id')
    .eq('id', clubId)
    .single()
    
  if (!club) return { success: false, error: '俱乐部不存在' }
  if (club.owner_id !== user.id) return { success: false, error: '权限不足：仅会长可修改信息' }

  // 3. 数据验证与处理
  const updateData: any = {}
  if (data.name) updateData.name = data.name.trim()
  if (data.description !== undefined) updateData.description = data.description
  if (data.avatarUrl) updateData.avatar_url = data.avatarUrl

  if (Object.keys(updateData).length === 0) {
    return { success: true, message: '无变更' }
  }

  try {
    const { error } = await supabase
      .from('clubs')
      .update(updateData)
      .eq('id', clubId)
      
    if (error) throw error
    
    return { success: true }
  } catch (error: any) {
    console.error('Update club error:', error)
    return { success: false, error: error.message || '更新失败' }
  }
}

export async function getClubJoinRequests(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未登录' }
  
  // 2. 验证俱乐部权限 (仅会长/管理员)
  const { data: club } = await supabase.from('clubs').select('owner_id').eq('id', clubId).single()
  if (!club) return { success: false, error: '俱乐部不存在' }

  let hasPermission = club.owner_id === user.id
  if (!hasPermission) {
    const { data: memberData } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single()
      
    if (!memberData || !['admin', 'owner'].includes(memberData.role)) {
      return { success: false, error: '权限不足' }
    }
  }
  
  // 3. 获取申请列表
  const { data: requests, error } = await supabase
    .from('club_members')
    .select(`
      user_id,
      joined_at,
      profiles (
        nickname,
        avatar_url,
        level
      )
    `)
    .eq('club_id', clubId)
    .eq('status', 'pending')
    
  if (error) return { success: false, error: error.message }
  
  interface JoinRequestResult {
    user_id: string
    joined_at: string
    profiles: {
      nickname: string
      avatar_url: string
      level: number
    } | null
  }

  const typedRequests = requests as unknown as JoinRequestResult[]

  return {
    success: true,
    requests: typedRequests.map((r) => ({
      userId: r.user_id,
      name: r.profiles?.nickname || 'Unknown',
      avatar: r.profiles?.avatar_url,
      level: r.profiles?.level || 1,
      appliedAt: r.joined_at
    }))
  }
}

export async function getClubMembers(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未登录' }
  
  // 成员列表通常对所有成员可见，只要在俱乐部里即可
  // 2. 验证是否为俱乐部成员
  const { data: member } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single()
    
  if (!member) return { success: false, error: '您不是该俱乐部成员' }
  
  try {
    const { data, error } = await supabase
      .from('club_members')
      .select(`
        *,
        profiles (
          id,
          nickname,
          avatar_url,
          level
        )
      `)
      .eq('club_id', clubId)
      .eq('status', 'active')
      
    if (error) throw error
    
    interface ClubMemberResult {
      user_id: string
      role: 'owner' | 'admin' | 'member'
      joined_at: string
      profiles: ProfileRow | null
    }

    const typedData = data as unknown as ClubMemberResult[]

    const members = typedData.map((item) => ({
      userId: item.user_id,
      role: item.role,
      joinedAt: item.joined_at,
      user: item.profiles
    }))
    
    return { success: true, data: members }
  } catch (error: any) {
    console.error('Get club members error:', error)
    return { success: false, error: error.message }
  }
}

export async function processJoinRequest(clubId: string, requestId: string, action: 'approve' | 'reject') {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未登录' }
  
  // 2. 验证俱乐部权限 (会长或管理员)
  const { data: club } = await supabase.from('clubs').select('owner_id').eq('id', clubId).single()
  if (!club) return { success: false, error: '俱乐部不存在' }

  let hasPermission = club.owner_id === user.id
  if (!hasPermission) {
    const { data: memberData } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single()
    if (memberData && memberData.role === 'admin') hasPermission = true
  }

  if (!hasPermission) return { success: false, error: '权限不足' }
  
  // 3. 验证请求有效性
  const applicantId = requestId 
  const { data: request } = await supabase
    .from('club_members')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', applicantId)
    .single()

  if (!request) return { success: false, error: '申请不存在' }
  if (request.status !== 'pending') return { success: false, error: '该申请已被处理' }

  try {
    if (action === 'approve') {
      const { error } = await supabase
        .from('club_members')
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('club_id', clubId)
        .eq('user_id', applicantId)
        
      if (error) throw error
      
      // Send notification (optional)
       await supabase.from('messages').insert({
         sender_id: user.id,
         receiver_id: applicantId,
         type: 'system',
         content: `恭喜！您加入俱乐部的申请已通过。`,
         is_read: false
       })

    } else {
      // Reject: delete the request
      const { error } = await supabase
        .from('club_members')
        .delete()
        .eq('club_id', clubId)
        .eq('user_id', applicantId)
        
      if (error) throw error
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('Process request error:', error)
    return { success: false, error: error.message }
  }
}

export async function kickMember(clubId: string, memberId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未登录' }
  
  // 2. 验证俱乐部权限 (会长或管理员)
  const { data: club } = await supabase.from('clubs').select('owner_id').eq('id', clubId).single()
  if (!club) return { success: false, error: '俱乐部不存在' }

  const isOwner = club.owner_id === user.id
  let isAdmin = false
  if (!isOwner) {
    const { data: memberData } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single()
    if (memberData && memberData.role === 'admin') isAdmin = true
  }

  if (!isOwner && !isAdmin) return { success: false, error: '权限不足' }
  
  // 3. 验证目标成员有效性
  if (memberId === user.id) return { success: false, error: '不能移除自己' }
  if (memberId === club.owner_id) return { success: false, error: '不能移除会长' }
  
  // 如果操作者是管理员，不能移除其他管理员
  if (isAdmin) {
    const { data: targetMember } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', memberId)
      .single()
    if (targetMember && (targetMember.role === 'admin' || targetMember.role === 'owner')) {
        return { success: false, error: '管理员权限不足以移除该成员' }
    }
  }

  try {
    const { error } = await supabase
      .from('club_members')
      .delete()
      .eq('club_id', clubId)
      .eq('user_id', memberId)
      
    if (error) throw error
    
    return { success: true }
  } catch (error: any) {
    console.error('Kick member error:', error)
    return { success: false, error: error.message }
  }
}

export async function disbandClub(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未登录' }
  
  // 2. 验证俱乐部权限 (仅会长)
  const { data: club } = await supabase
    .from('clubs')
    .select('owner_id')
    .eq('id', clubId)
    .single()
    
  if (!club) return { success: false, error: '俱乐部不存在' }
  if (club.owner_id !== user.id) return { success: false, error: '权限不足：仅会长可解散俱乐部' }
  
  // 3. 执行解散
  try {
    // Transaction-like deletion
    
    // 1. Delete members
    await supabase.from('club_members')
      .delete()
      .eq('club_id', clubId)
      
    // 2. Delete club
    const { error } = await supabase
      .from('clubs')
      .delete()
      .eq('id', clubId)
      
    if (error) throw error
    
    return { success: true }
  } catch (error: any) {
    console.error('Disband club error:', error)
    return { success: false, error: error.message }
  }
}

// ==================== Data Fetching for View ====================

export async function getClubLeaderboard(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Get all club members first
  const { data: members, error } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('status', 'active')

  if (error || !members) return []

  const memberIds = members.map((m) => m.user_id)

  if (memberIds.length === 0) return []

  // Get profiles with stats
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, nickname, avatar_url, total_area, level')
    .in('id', memberIds)
    .order('total_area', { ascending: false })

  if (!profiles) return []

  return profiles.map((p) => ({
    id: p.id,
    name: p.nickname || 'Unknown',
    avatar: p.avatar_url,
    area: p.total_area || 0,
    score: (p.total_area || 0) * 10 // Simple score formula
  }))
}

export async function getClubTerritories(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Get all club members
  const { data: members } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('status', 'active')

  if (!members || members.length === 0) return []

  const memberIds = members.map((m) => m.user_id)

  // Get territories owned by members
  // Limit to recent 50 for performance
  const { data: territories } = await supabase
    .from('territories')
    .select(`
      id,
      city_id,
      owner_id,
      captured_at,
      profiles (
        nickname,
        avatar_url
      )
    `)
    .in('owner_id', memberIds)
    .order('captured_at', { ascending: false })
    .limit(50)

  if (!territories) return []

  interface ClubTerritoryResult {
    id: string
    city_id: string
    owner_id: string
    captured_at: string
    profiles: {
      nickname: string
      avatar_url: string
    } | null
  }

  const typedTerritories = territories as unknown as ClubTerritoryResult[]

  // Map to expected format
  // Note: Territory table doesn't have name/area directly usually, or id is H3 index.
  // We'll mock name/area based on ID or city.
  return typedTerritories.map((t) => ({
    id: t.id,
    name: `Territory ${t.id.substring(0, 6)}...`,
    area: 1, // Single hex
    date: t.captured_at,
    member: t.profiles?.avatar_url,
    memberName: t.profiles?.nickname || 'Unknown',
    lastTime: new Date(t.captured_at).toLocaleDateString(),
    location: t.city_id
  }))
}


