'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

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
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  let user: { id: string } | null = authUser
  // Fallback to first profile if no auth user (Dev/Demo mode)
  if (!user) {
    const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
    if (profiles && profiles.length > 0) {
      user = { id: (profiles[0] as any).id } as any
    }
  }

  if (!user) throw new Error('Unauthorized')

  // Prepare insert data based on actual schema
  // Note: level, rating, member_count, territory are not in DB schema yet
  const insertData: any = {
    name: data.name,
    description: data.description,
    owner_id: user.id,
    avatar_url: data.avatar_url, 
  }

  try {
    const { data: club, error } = await (supabase
      .from('clubs' as any) as any)
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Database Error:', JSON.stringify(error, null, 2))
      throw error
    }

    // Return with default values for missing DB columns to satisfy UI types
    return {
      ...(club as any),
      level: '初级',
      rating: 5.0,
      member_count: 1,
      territory: '0 mi²'
    }
  } catch (err) {
    console.error('Create Club Exception:', err)
    throw err
  }
}

export async function updateClub(clubId: string, data: Partial<Club>) {
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    
    const { error } = await (supabase
        .from('clubs' as any) as any)
        .update(data)
        .eq('id', clubId)
        
    if (error) throw error
    return { success: true }
}

export async function getClubs() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 模拟从数据库获取
  const { data, error } = await supabase
    .from('clubs' as any)
    .select('*')
    
  // 由于数据库可能还没有 clubs 表，这里暂时返回空或 Mock 数据
  if (error) {
    console.warn('Fetching clubs failed, returning mock data', error)
    return []
  }
  
  // Return with default values for missing DB columns to satisfy UI types
  return data.map((club: any) => ({
    ...club,
    level: club.level || '初级',
    rating: club.rating || 5.0,
    member_count: club.member_count || 1,
    territory: club.territory || '0 mi²'
  }))
}

export async function joinClub(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // 1. 检查是否已经加入
  const { data: existing } = await supabase
    .from('club_members' as any)
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single()
    
  if (existing) {
    if ((existing as any).status === 'pending') throw new Error('申请审核中')
    if ((existing as any).status === 'active') throw new Error('已加入该俱乐部')
  }
  
  // 2. 插入申请记录 (status = pending)
  const { error } = await (supabase
    .from('club_members' as any) as any)
    .insert({
      club_id: clubId,
      user_id: user.id,
      role: 'member',
      status: 'pending'
    })
    
  if (error) throw error
  
  // 3. 通知 Owner (获取 Owner ID)
  const { data: club } = await supabase
    .from('clubs' as any)
    .select('owner_id, name')
    .eq('id', clubId)
    .single()
    
  if (club && (club as any).owner_id) {
     await (supabase.from('messages' as any) as any).insert({
       sender_id: user.id,
       receiver_id: (club as any).owner_id,
       type: 'system',
       content: `用户申请加入您的俱乐部 "${(club as any).name}"`,
       is_read: false
     })
   }
  
  return { success: true }
}

export async function leaveClub(clubId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Check if owner
  const { data: club } = await supabase
    .from('clubs' as any)
    .select('owner_id')
    .eq('id', clubId)
    .single()

  if (club && (club as any).owner_id === user.id) {
    throw new Error('会长无法退出俱乐部，请先转让会长或解散俱乐部')
  }

  const { error } = await supabase
    .from('club_members' as any)
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
  return club.owner_id === userId
}

// ==================== New Management Actions ====================

export async function updateClubInfo(clubId: string, data: { name?: string, description?: string, avatarUrl?: string }) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // 1. 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '未登录' }
  
  // 2. 验证俱乐部权限 (仅会长)
  const { data: clubData } = await (supabase
    .from('clubs' as any) as any)
    .select('owner_id')
    .eq('id', clubId)
    .single()
  const club = clubData as { owner_id: string } | null
    
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
    const { error } = await (supabase
      .from('clubs' as any) as any)
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
  // 这里我们暂时只允许会长，或者检查 club_members 表中的 role
  // 为了保持一致性，先检查 Owner，如果不是 Owner，检查是否是 Admin
  const { data: clubData } = await (supabase.from('clubs' as any) as any).select('owner_id').eq('id', clubId).single()
  const club = clubData as { owner_id: string } | null
  if (!club) return { success: false, error: '俱乐部不存在' }

  let hasPermission = club.owner_id === user.id
  if (!hasPermission) {
    const { data: memberData } = await (supabase
      .from('club_members' as any) as any)
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single()
    const member = memberData as { role: string } | null
    if (member && member.role === 'admin') hasPermission = true
  }

  if (!hasPermission) return { success: false, error: '权限不足' }
  
  try {
    // Assuming club_members has a foreign key to profiles via user_id
    const { data, error } = await (supabase
      .from('club_members' as any) as any)
      .select(`
        *,
        profiles:user_id (
          id,
          nickname,
          avatar_url,
          level
        )
      `)
      .eq('club_id', clubId)
      .eq('status', 'pending')
      
    if (error) throw error
    
    // Flatten the structure for easier consumption
    const requests = data.map((item: any) => ({
      requestId: item.user_id, // Using user_id as request ID since it's unique per club
      user: item.profiles,
      appliedAt: item.joined_at || item.created_at // Fallback
    }))
    
    return { success: true, data: requests }
  } catch (error: any) {
    console.error('Get join requests error:', error)
    return { success: false, error: error.message }
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
    const { data, error } = await (supabase
      .from('club_members' as any) as any)
      .select(`
        *,
        profiles:user_id (
          id,
          nickname,
          avatar_url,
          level
        )
      `)
      .eq('club_id', clubId)
      .eq('status', 'active')
      
    if (error) throw error
    
    const members = data.map((item: any) => ({
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
  const { data: clubData } = await (supabase.from('clubs' as any) as any).select('owner_id').eq('id', clubId).single()
  const club = clubData as { owner_id: string } | null
  if (!club) return { success: false, error: '俱乐部不存在' }

  let hasPermission = club.owner_id === user.id
  if (!hasPermission) {
    const { data: memberData } = await (supabase
      .from('club_members' as any) as any)
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single()
    const member = memberData as { role: string } | null
    if (member && member.role === 'admin') hasPermission = true
  }

  if (!hasPermission) return { success: false, error: '权限不足' }
  
  // 3. 验证请求有效性
  const applicantId = requestId 
  const { data: requestData } = await (supabase
    .from('club_members' as any) as any)
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', applicantId)
    .single()
  const request = requestData as { status: string } | null

  if (!request) return { success: false, error: '申请不存在' }
  if (request.status !== 'pending') return { success: false, error: '该申请已被处理' }

  try {
    if (action === 'approve') {
      const { error } = await (supabase
        .from('club_members' as any) as any)
        .update({ status: 'active', joined_at: new Date().toISOString() })
        .eq('club_id', clubId)
        .eq('user_id', applicantId)
        
      if (error) throw error
      
      // Send notification (optional)
       await (supabase.from('messages' as any) as any).insert({
         sender_id: user.id,
         receiver_id: applicantId,
         type: 'system',
         content: `恭喜！您加入俱乐部的申请已通过。`,
         is_read: false
       })

    } else {
      // Reject: delete the request
      const { error } = await (supabase
        .from('club_members' as any) as any)
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
  const { data: clubData } = await (supabase.from('clubs' as any) as any).select('owner_id').eq('id', clubId).single()
  const club = clubData as { owner_id: string } | null
  if (!club) return { success: false, error: '俱乐部不存在' }

  const isOwner = club.owner_id === user.id
  let isAdmin = false
  if (!isOwner) {
    const { data: memberData } = await (supabase
      .from('club_members' as any) as any)
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .single()
    const member = memberData as { role: string } | null
    if (member && member.role === 'admin') isAdmin = true
  }

  if (!isOwner && !isAdmin) return { success: false, error: '权限不足' }
  
  // 3. 验证目标成员有效性
  if (memberId === user.id) return { success: false, error: '不能移除自己' }
  if (memberId === club.owner_id) return { success: false, error: '不能移除会长' }
  
  // 如果操作者是管理员，不能移除其他管理员
  if (isAdmin) {
    const { data: targetMemberData } = await (supabase
      .from('club_members' as any) as any)
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', memberId)
      .single()
    const targetMember = targetMemberData as { role: string } | null
    if (targetMember && (targetMember.role === 'admin' || targetMember.role === 'owner')) {
        return { success: false, error: '管理员权限不足以移除该成员' }
    }
  }

  try {
    const { error } = await (supabase
      .from('club_members' as any) as any)
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
  const { data: clubData } = await (supabase
    .from('clubs' as any) as any)
    .select('owner_id')
    .eq('id', clubId)
    .single()
  const club = clubData as { owner_id: string } | null
    
  if (!club) return { success: false, error: '俱乐部不存在' }
  if (club.owner_id !== user.id) return { success: false, error: '权限不足：仅会长可解散俱乐部' }
  
  // 3. 执行解散
  try {
    // Transaction-like deletion
    
    // 1. Delete members
    await (supabase.from('club_members' as any) as any)
      .delete()
      .eq('club_id', clubId)
      
    // 2. Delete club
    const { error } = await (supabase
      .from('clubs' as any) as any)
      .delete()
      .eq('id', clubId)
      
    if (error) throw error
    
    return { success: true }
  } catch (error: any) {
    console.error('Disband club error:', error)
    return { success: false, error: error.message }
  }
}


