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
  status?: 'active' | 'pending' | 'rejected'
  audit_reason?: string | null
  province?: string
  total_area?: number
  is_public?: boolean
}

export type ClubMember = {
  club_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'active'
  joined_at: string
}

export async function createClub(data: { 
  name: string; 
  description?: string; 
  avatar_url?: string;
  province?: string;
  is_public?: boolean;
}) {
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
      province: data.province || null,
      is_public: data.is_public ?? true, 
      status: 'pending', // Pending audit
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

export async function getPendingClubs() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data, error } = await supabase
    .from('clubs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    
  if (error) {
    console.error('Error fetching pending clubs:', error)
    return []
  }

  return data as Club[]
}

export async function approveClub(clubId: string) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // 1. Update club status
    const { data: club, error } = await supabase
        .from('clubs')
        .update({ status: 'active' })
        .eq('id', clubId)
        .select('owner_id, name')
        .single()
        
    if (error) return { success: false, error: error.message }
    
    // 2. Send notification
    if (club && club.owner_id) {
        await supabase.from('notifications').insert({
            user_id: club.owner_id,
            title: '俱乐部审核通过',
            message: `恭喜！您创建的俱乐部“${club.name}”已通过审核，快去管理您的俱乐部吧。`,
            type: 'system'
        })
    }
    
    return { success: true }
}

export async function rejectClub(clubId: string, reason: string) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    // 1. Update club status
    const { data: club, error } = await supabase
        .from('clubs')
        .update({ 
            status: 'rejected',
            audit_reason: reason 
        })
        .eq('id', clubId)
        .select('owner_id, name')
        .single()
        
    if (error) return { success: false, error: error.message }
    
    // 2. Send notification
    if (club && club.owner_id) {
        await supabase.from('notifications').insert({
            user_id: club.owner_id,
            title: '俱乐部审核未通过',
            message: `很遗憾，您的俱乐部“${club.name}”申请未通过。原因：${reason}`,
            type: 'system'
        })
    }
    
    return { success: true }
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
    .eq('status', 'active')
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

    // 0. Get Club Info to check is_public
    const { data: club, error: clubError } = await supabase
        .from('clubs')
        .select('is_public')
        .eq('id', clubId)
        .single()
    
    if (clubError) {
        return { success: false, error: 'Club not found' }
    }
    
    // 1. 检查是否已经加入
    const { data: existing, error: checkError } = await supabase
        .from('club_members')
        .select('status')
        .eq('club_id', clubId)
        .eq('user_id', user.id)
        .maybeSingle()
        
    if (checkError) {
        console.error('Check Membership Error:', checkError)
        return { 
            success: false, 
            error: `查询成员状态失败: ${checkError.message} (Code: ${checkError.code})` 
        }
    }
        
    if (existing) {
        if (existing.status === 'pending') return { success: false, error: '申请审核中' }
        if (existing.status === 'active') return { success: false, error: '已加入该俱乐部' }
    }
    
    // 2. 决定初始状态
    // Default to true if null, matching the DB default
    const isPublic = club.is_public ?? true
    const initialStatus = isPublic ? 'active' : 'pending'
    
    // 3. 插入申请记录
    const { error } = await supabase
        .from('club_members')
        .insert({
        club_id: clubId,
        user_id: user.id,
        role: 'member',
        status: initialStatus
        })
        
    if (error) {
        console.error('Join Club Error:', error)
        return { success: false, error: error.message }
    }

    // 4. 如果直接加入，更新成员计数
    if (initialStatus === 'active') {
        await supabase.rpc('increment_club_member_count', { row_id: clubId })
    }
    
    return { success: true, status: initialStatus }
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

  // Decrement member count
  await supabase.rpc('decrement_club_member_count', { row_id: clubId })
  
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

// ==================== Data Fetching for View (Refactored) ====================

// 1. Get Club Rankings (Province/National)
export async function getClubRankings(type: 'province' | 'national', province?: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  let query = supabase.from('clubs')
    .select('id, name, avatar_url, total_area, province, member_count')
    .eq('status', 'active')
    .order('total_area', { ascending: false })
    .limit(100)

  if (type === 'province' && province) {
    query = query.eq('province', province)
  }

  const { data: clubs, error } = await query

  if (error) {
    console.error('Fetch Rankings Error:', error)
    return { data: [], myClub: null }
  }

  // Calculate my rank (simplified: if in top 100, return it. If not, separate query)
  let myClubRank = null
  let myClubData = null
  
  if (user) {
    // Get my club id
    const { data: membership } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()
        
    if (membership) {
        const myClubId = membership.club_id
        const rankIndex = (clubs as any[]).findIndex((c: any) => c.id === myClubId)
        
        if (rankIndex !== -1) {
            myClubRank = rankIndex + 1
            myClubData = clubs[rankIndex]
        } else {
            // Fetch my club data specifically if not in top 100
             const { data: myClub, error: myClubError } = await supabase
                .from('clubs')
                .select('id, name, avatar_url, total_area, province, member_count')
                .eq('id', myClubId)
                .single()
             
             if (myClub && !myClubError) {
                // Count how many have more area to get rank
                let rankQuery = supabase.from('clubs').select('id', { count: 'exact', head: true }).gt('total_area', myClub.total_area || 0).eq('status', 'active')
                if (type === 'province' && province) {
                    rankQuery = rankQuery.eq('province', province)
                }
                const { count } = await rankQuery
                myClubRank = (count || 0) + 1
                myClubData = myClub
             }
        }
    }
  }

  return {
    data: (clubs as any[]).map((c: any, i: number) => ({
      ...c,
      rank: i + 1,
      score: c.total_area || 0
    })),
    myClub: myClubData ? { ...(myClubData as any), rank: myClubRank, score: (myClubData as any).total_area || 0 } : null
  }
}

// 2. Get Internal Members (Sorted by Contribution)
export async function getInternalMembers(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Join club_members with profiles to get name, avatar, and total_area (contribution)
  const { data, error } = await supabase
    .from('club_members')
    .select(`
      user_id,
      role,
      joined_at,
      profiles:user_id (
        id, nickname, avatar_url, total_area
      )
    `)
    .eq('club_id', clubId)
    .eq('status', 'active')
  
  if (error) {
    console.error('Fetch Members Error:', error)
    return []
  }

  // Sort by total_area desc
  const members = (data || []).map((m: any) => ({
    id: m.profiles?.id,
    name: m.profiles?.nickname || 'Unknown',
    avatar: m.profiles?.avatar_url,
    area: m.profiles?.total_area || 0,
    role: m.role
  }))

  return members.sort((a: any, b: any) => b.area - a.area).map((m: any, i: number) => ({ ...m, rank: i + 1 }))
}

// 3. Get Club Territories (Runs)
export async function getClubTerritoriesReal(clubId: string, sortBy: 'date' | 'area') {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  let query = supabase
    .from('runs')
    .select(`
      id,
      area,
      duration,
      created_at,
      province,
      profiles:user_id (
        nickname, avatar_url
      )
    `)
    .eq('club_id', clubId)
    
  if (sortBy === 'date') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('area', { ascending: false })
  }

  const { data, error } = await query.limit(50) // Limit to 50 for performance

  if (error) {
    console.error('Fetch Territories Error:', error)
    return []
  }

  return (data || []).map((run: any) => ({
    id: run.id,
    name: `Run ${run.id.substring(0,6)}`,
    area: run.area,
    date: new Date(run.created_at).toLocaleDateString(),
    member: run.profiles?.avatar_url,
    memberName: run.profiles?.nickname,
    lastTime: new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    location: run.province || 'Unknown',
    totalTime: `${Math.floor(run.duration / 60)}:${(run.duration % 60).toString().padStart(2, '0')}`,
    totalDistance: 'N/A', 
    avgPace: 'N/A'
  }))
}

// 4. Get Club History
export async function getClubHistory(clubId: string) {
   // Fetch last 30 days runs
   const cookieStore = await cookies()
   const supabase = createClient(cookieStore)
   
   const thirtyDaysAgo = new Date()
   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
   
   const { data, error } = await supabase
     .from('runs')
     .select('created_at, area')
     .eq('club_id', clubId)
     .gte('created_at', thirtyDaysAgo.toISOString())
     .order('created_at', { ascending: true })

   if (error) return []

   // Aggregate by date
   const historyMap = new Map<string, number>()
   
   // Pre-fill last 30 days with 0
   for (let i = 29; i >= 0; i--) {
       const d = new Date()
       d.setDate(d.getDate() - i)
       const key = d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
       historyMap.set(key, 0)
   }

   (data || []).forEach((run: any) => {
      const date = new Date(run.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
      if (historyMap.has(date)) {
          historyMap.set(date, (historyMap.get(date) || 0) + Number(run.area))
      }
   })

   // Convert to array
   const history = Array.from(historyMap.entries()).map(([date, area]) => ({ date, area }))
   return history
}

// Kept for compatibility if needed, but replaced by specific calls in new UI
export async function getClubLeaderboard(clubId: string) {
    return getInternalMembers(clubId)
}

export async function getClubTerritories(clubId: string) {
    return getClubTerritoriesReal(clubId, 'date')
}

// 5. Get Distinct Provinces (Source of Truth for Filter)
export async function getAvailableProvinces() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  // Fetch all active clubs with non-null provinces
  // Supabase doesn't have a direct 'distinct' select modifier like Prisma, 
  // so we fetch the 'province' column and deduplicate in application logic.
  // This is efficient enough for < 10,000 clubs.
  
  const { data, error } = await supabase
    .from('clubs')
    .select('province')
    .eq('status', 'active')
    .not('province', 'is', null)
    
  if (error) {
    console.error('[getAvailableProvinces] Error:', error)
    return []
  }

  // Deduplicate using Set and Sort alphabetically/pinyin
  // Filtering Boolean ensures no empty strings or nulls remain
  const provinces = Array.from(new Set(data.map(d => d.province).filter(Boolean))).sort((a, b) => {
      return (a || '').localeCompare(b || '', 'zh-CN')
  })
  
  return provinces
}