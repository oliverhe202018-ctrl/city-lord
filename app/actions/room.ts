'use server'

import { createClient } from '@/lib/supabase/server'

export type Room = {
  id: string
  name: string
  host_id: string
  host_name?: string
  target_distance_km: number | null
  target_duration_minutes: number | null
  max_participants: number
  participants_count: number
  is_private: boolean
  is_locked: boolean 
  status: 'waiting' | 'active' | 'ended'
  created_at: string
  invite_code?: string
  allow_chat?: boolean
  allow_imports?: boolean
  avatar_url?: string
  allow_member_invite?: boolean
}

export type CreateRoomData = {
  name: string
  target_distance_km?: number
  target_duration_minutes?: number
  max_participants?: number
  is_private?: boolean
  password?: string
  allow_chat?: boolean
  allow_imports?: boolean
  allow_member_invite?: boolean
  avatar_url?: string
}

export async function fetchRoomDetails(roomId: string) {
  const supabase = await createClient()

  const { data: room, error } = await supabase
    .from('rooms')
    .select(`
      *,
      host:profiles!host_id(nickname),
      participants:room_participants(count)
    `)
    .eq('id', roomId)
    .single()

  if (error || !room) return null

  return {
    id: room.id,
    name: room.name,
    host_id: room.host_id,
    host_name: room.host?.nickname || 'Unknown',
    target_distance_km: room.target_distance_km,
    target_duration_minutes: room.target_duration_minutes,
    max_participants: room.max_participants,
    participants_count: room.participants?.[0]?.count || 0,
    is_private: room.is_private,
    is_locked: room.is_private,
    status: room.status,
    created_at: room.created_at,
    invite_code: room.invite_code,
    allow_chat: room.allow_chat,
    allow_imports: room.allow_imports,
    allow_member_invite: room.allow_member_invite,
    avatar_url: room.avatar_url
  } as Room
}

export async function getCurrentRoom() {
  const supabase = await createClient()
  await supabase.auth.getSession()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Find the most recently joined room that is active/waiting
  const { data: participation, error } = await supabase
    .from('room_participants')
    .select(`
      room:rooms (
        *,
        host:profiles!host_id(nickname),
        participants:room_participants(count)
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !participation || !participation.room) return null

  const room = participation.room as any
  
  // Return formatted room
  return {
    id: room.id,
    name: room.name,
    host_id: room.host_id,
    host_name: room.host?.nickname || 'Unknown',
    target_distance_km: room.target_distance_km,
    target_duration_minutes: room.target_duration_minutes,
    max_participants: room.max_participants,
    participants_count: room.participants?.[0]?.count || 0,
    is_private: room.is_private,
    is_locked: room.is_private,
    status: room.status,
    created_at: room.created_at,
    invite_code: room.invite_code,
    allow_chat: room.allow_chat,
    allow_imports: room.allow_imports,
    allow_member_invite: room.allow_member_invite,
    avatar_url: room.avatar_url
  } as Room
}

export async function getRooms() {
  const supabase = await createClient()

  const { data: rooms, error } = await supabase
    .from('rooms')
    .select(`
      *,
      host:profiles!host_id(nickname),
      participants:room_participants(count)
    `)
    .in('status', ['waiting', 'active'])
    .eq('is_banned', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching rooms:', error)
    return []
  }

  return rooms.map((room: any) => ({
    id: room.id,
    name: room.name,
    host_id: room.host_id,
    host_name: room.host?.nickname || 'Unknown',
    target_distance_km: room.target_distance_km,
    target_duration_minutes: room.target_duration_minutes,
    max_participants: room.max_participants,
    participants_count: room.participants?.[0]?.count || 0,
    is_private: room.is_private,
    is_locked: room.is_private, 
    status: room.status,
    created_at: room.created_at,
    invite_code: room.invite_code,
    allow_chat: room.allow_chat,
    allow_imports: room.allow_imports,
    allow_member_invite: room.allow_member_invite,
    avatar_url: room.avatar_url
  })) as Room[]
}

export async function createRoom(data: CreateRoomData) {
  try {
    const supabase = await createClient()
    
    // Auth Fix: Use getUser instead of getSession
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    // Strict Auth Check (Golden Rule #5)
    if (authError || !authUser) return { success: false, error: '请先登录' }
    
    const user = authUser

    // 1. Create Room
    // Generate a 6-digit invite code if not provided by DB default (we force it here to be safe)
    const inviteCode = Math.floor(100000 + Math.random() * 900000).toString();

    const { data: room, error: createError } = await (supabase
      .from('rooms' as any) as any)
      .insert({
        name: data.name,
        host_id: user.id,
        target_distance_km: data.target_distance_km,
        target_duration_minutes: data.target_duration_minutes,
        max_participants: data.max_participants || 10,
        is_private: data.is_private || false,
        password: data.password || null,
        allow_chat: data.allow_chat ?? true,
        allow_imports: data.allow_imports ?? true,
        allow_member_invite: data.allow_member_invite ?? true,
        avatar_url: data.avatar_url || null,
        status: 'waiting',
        invite_code: inviteCode
      })
      .select()
      .single()

    if (createError) {
      console.error('Create Room Error:', createError.message, createError.details); // 必须打印 details
      throw new Error(createError.message);
    }

    // 2. Join Room automatically as host
    const { error: joinError } = await (supabase
      .from('room_participants' as any) as any)
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: 'host'
      })

    if (joinError) {
      await (supabase.from('rooms' as any) as any).delete().eq('id', room.id)
      throw joinError
    }

    const fullRoom = await fetchRoomDetails(room.id);
    return { success: true, room: fullRoom }

  } catch (error: any) {
    console.error('Create Room Error:', error)
    return { success: false, error: error.message || '创建房间失败' }
  }
}

export async function joinRoomByCode(code: string) {
  try {
    const supabase = await createClient()
    
    // Auth Fix: Use getUser instead of getSession
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    
    // Strict Auth Check
    if (authError || !authUser) return { success: false, error: '请先登录' }
    
    const user = authUser

    // 1. Find room by code
    const { data: room, error: findError } = await (supabase
      .from('rooms' as any) as any)
      .select('id, max_participants, participants:room_participants(count)')
      .eq('invite_code', code)
      .single()

    if (findError || !room) {
      return { success: false, error: '无效的邀请码' }
    }

    // 2. Check if already joined
    const { data: membership } = await (supabase
      .from('room_participants' as any) as any)
      .select('room_id')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .single()

    if (membership) {
      const fullRoom = await fetchRoomDetails(room.id);
      return { success: true, room: fullRoom, message: '已加入该房间' }
    }

    // 3. Check capacity
    const currentCount = (room as any).participants?.[0]?.count || 0
    if (currentCount >= (room as any).max_participants) {
      return { success: false, error: '房间已满' }
    }

    // 4. Join
    const { error: joinError } = await (supabase
      .from('room_participants' as any) as any)
      .insert({
        room_id: room.id,
        user_id: user.id,
        role: 'member'
      })

    if (joinError) throw joinError
    
    const fullRoom = await fetchRoomDetails(room.id);
    return { success: true, room: fullRoom }

  } catch (error: any) {
    console.error('Join Room Error:', error)
    return { success: false, error: error.message || '加入房间失败' }
  }
}

export async function joinRoom(roomId: string, password?: string) {
  // This function seems less used now with invite codes, but keeping for compatibility
  // Updating to return simple success object
  try {
    const supabase = await createClient()
    await supabase.auth.getSession() // Login State Patch
    
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    // Strict Auth Check
    if (!authUser) throw new Error('Unauthorized')
    
    const user = authUser

    // 1. Check if already joined
    const { data: membership } = await (supabase
      .from('room_participants' as any) as any)
      .select('room_id')
      .eq('room_id', roomId)
      .eq('user_id', user.id)
      .single()

    if (membership) {
      return { success: true }
    }

    // 2. Fetch room details
    const { data: room, error: fetchError } = await (supabase
      .from('rooms' as any) as any)
      .select('max_participants, is_private, password, participants:room_participants(count)')
      .eq('id', roomId)
      .single()

    if (fetchError || !room) throw new Error('Room not found')

    // Check capacity
    const currentCount = (room as any).participants?.[0]?.count || 0
    if (currentCount >= (room as any).max_participants) {
      throw new Error('Room is full')
    }

    // Check password
    if ((room as any).is_private && (room as any).password !== password) {
      throw new Error('Invalid password')
    }

    // 3. Join
    const { error: joinError } = await (supabase
      .from('room_participants' as any) as any)
      .insert({
        room_id: roomId,
        user_id: user.id,
        role: 'member'
      })

    if (joinError) throw joinError
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function leaveRoom(roomId: string) {
  try {
    const supabase = await createClient()
    await supabase.auth.getSession() // Login State Patch
    
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    // Strict Auth Check
    if (!authUser) return { success: false, error: '未登录' }
    
    const user = authUser

    // 1. Check if user is host
    const { data: room, error: fetchError } = await (supabase
        .from('rooms' as any) as any)
        .select('host_id')
        .eq('id', roomId)
        .single()

    if (fetchError || !room) {
        return { success: false, error: '房间不存在' }
    }

    // 2. If host, delete the room (dissolve)
    if (room.host_id === user.id) {
        const { error: deleteError } = await (supabase
            .from('rooms' as any) as any)
            .delete()
            .eq('id', roomId)
        
        if (deleteError) throw deleteError
        return { success: true, dissolved: true }
    }

    // 3. If member, just leave
    const { error } = await (supabase
      .from('room_participants' as any) as any)
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id)

    if (error) throw error

    // If room is empty (should ideally be handled by host check, but for safety), delete it
    // Actually, if host logic covers it, this part is for when last member leaves? 
    // No, if host leaves room is gone. If member leaves, room stays unless empty?
    // Let's keep the cleanup logic just in case but usually host check handles dissolution.
    const { count } = await (supabase
      .from('room_participants' as any) as any)
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)

    if (count === 0) {
       await (supabase.from('rooms' as any) as any).delete().eq('id', roomId)
    }

    return { success: true, dissolved: false }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getJoinedRooms() {
  try {
    const supabase = await createClient()
    
    const { data: { user: authUser } } = await supabase.auth.getUser()
    
    // Strict Auth Check
    if (!authUser) return { success: true, rooms: [] }
    
    const user = authUser

    const { data: participations, error } = await (supabase
      .from('room_participants' as any) as any)
      .select(`
        room:rooms (
          *,
          host:profiles!host_id(nickname),
          participants:room_participants(count)
        )
      `)
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })

    if (error) throw error

    const rooms = participations.map((p: any) => {
      const room = p.room
      return {
        id: room.id,
        name: room.name,
        host_id: room.host_id,
        host_name: room.host?.nickname || 'Unknown',
        target_distance_km: room.target_distance_km,
        target_duration_minutes: room.target_duration_minutes,
        max_participants: room.max_participants,
        participants_count: room.participants?.[0]?.count || 0,
        is_private: room.is_private,
        is_locked: room.is_private,
        status: room.status,
        created_at: room.created_at,
        invite_code: room.invite_code,
        allow_chat: room.allow_chat,
        allow_imports: room.allow_imports,
        allow_member_invite: room.allow_member_invite,
        avatar_url: room.avatar_url
      }
    })

    return { success: true, rooms: rooms as Room[] }
  } catch (error: any) {
    console.error('Get Joined Rooms Error:', error)
    return { success: false, error: error.message }
  }
}
