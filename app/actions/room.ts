'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

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
  is_locked: boolean // calculated field for UI (based on is_private)
  status: 'waiting' | 'active' | 'ended'
  created_at: string
}

export type CreateRoomData = {
  name: string
  target_distance_km?: number
  target_duration_minutes?: number
  max_participants?: number
  is_private?: boolean
  password?: string
}

export async function getRooms() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

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
    is_locked: room.is_private, // In UI, private means locked/password needed
    status: room.status,
    created_at: room.created_at
  })) as Room[]
}

export async function createRoom(data: CreateRoomData) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  // MOCK USER FOR DEVELOPMENT IF NO AUTH
  let user = authUser
  if (!user) {
     const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
     if (profiles && profiles.length > 0) {
        user = { id: (profiles[0] as any).id } as any
     }
  }

  if (!user) throw new Error('Unauthorized - No user found (even mock)')

  // 1. Create Room
  const { data: room, error: createError } = await (supabase
    .from('rooms' as any) as any)
    .insert({
      host_id: user.id,
      name: data.name,
      target_distance_km: data.target_distance_km,
      target_duration_minutes: data.target_duration_minutes,
      max_participants: data.max_participants || 10,
      is_private: data.is_private || false,
      password: data.password || null,
      status: 'waiting'
    })
    .select()
    .single()

  if (createError) throw createError

  // 2. Join Room automatically
  const { error: joinError } = await (supabase
    .from('room_participants' as any) as any)
    .insert({
      room_id: room.id,
      user_id: user.id
    })

  if (joinError) {
    // If join fails, try to cleanup room (best effort)
    await (supabase.from('rooms' as any) as any).delete().eq('id', room.id)
    throw joinError
  }

  return room
}

export async function joinRoom(roomId: string, password?: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  // MOCK USER FOR DEVELOPMENT IF NO AUTH
  let user = authUser
  if (!user) {
     const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
     if (profiles && profiles.length > 0) {
        user = { id: (profiles[0] as any).id } as any
     }
  }

  if (!user) throw new Error('Unauthorized - No user found')

  // 1. Check if user is already in a room? 
  // For simplicity, we might allow checking this, or just let DB constraints handle unique if we added one.
  // But let's check first to be clean.
  const { data: currentRoom } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', user.id)
    .single()

  if (currentRoom) {
    throw new Error('You are already in a room. Please leave it first.')
  }

  // 2. Fetch room details to check constraints
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
      user_id: user.id
    })

  if (joinError) throw joinError
  
  return { success: true }
}

export async function leaveRoom(roomId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  // MOCK USER FOR DEVELOPMENT IF NO AUTH
  let user = authUser
  if (!user) {
     const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
     if (profiles && profiles.length > 0) {
        user = { id: (profiles[0] as any).id } as any
     }
  }

  if (!user) throw new Error('Unauthorized')

  const { error } = await (supabase
    .from('room_participants' as any) as any)
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', user.id)

  if (error) throw error

  // Optional: If room is empty, delete it? Or if host leaves, assign new host?
  // For now, let's keep it simple. If host leaves, maybe room persists until everyone leaves?
  // Or delete if empty.
  
  const { count } = await (supabase
    .from('room_participants' as any) as any)
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)

  if (count === 0) {
     await (supabase.from('rooms' as any) as any).delete().eq('id', roomId)
  }

  return { success: true }
}

export async function getCurrentRoom() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  const { data: { user: authUser } } = await supabase.auth.getUser()
  
  // MOCK USER FOR DEVELOPMENT IF NO AUTH
  let user = authUser
  if (!user) {
     const { data: profiles } = await supabase.from('profiles').select('id').limit(1)
     if (profiles && profiles.length > 0) {
        user = { id: (profiles[0] as any).id } as any
     }
  }

  if (!user) return null

  // Get joined room ID
  const { data: participation } = await supabase
    .from('room_participants')
    .select('room_id')
    .eq('user_id', user.id)
    .single()

  if (!participation) return null

  // Get full room details
  const { data: room } = await (supabase
    .from('rooms' as any) as any)
    .select(`
      *,
      host:profiles!host_id(nickname),
      participants:room_participants(
        user_id,
        joined_at,
        total_score,
        territory_area,
        territory_ratio,
        stolen_lands,
        lost_lands,
        rivals_defeated,
        growth_rate,
        status,
        profile:profiles!user_id(nickname, avatar_url, level)
      )
    `)
    .eq('id', (participation as any).room_id)
    .single()
    
  if (!room) return null

  // Transform to flat structure
  const participants = (room as any).participants.map((p: any) => ({
       id: p.user_id,
       nickname: p.profile?.nickname || 'Unknown',
       avatar_url: p.profile?.avatar_url,
       level: p.profile?.level || 1,
       joined_at: p.joined_at,
       // Stats
       total_score: p.total_score || 0,
       territory_area: p.territory_area || 0,
       territory_ratio: p.territory_ratio || 0,
       stolen_lands: p.stolen_lands || 0,
       lost_lands: p.lost_lands || 0,
       rivals_defeated: p.rivals_defeated || 0,
       growth_rate: p.growth_rate || 0,
       status: p.status || 'active'
  }))

  return {
    ...room,
    host_name: (room as any).host?.nickname || 'Unknown',
    participants
  }
}

// Dev Only: Simulate game data updates
export async function dev_simulateGameUpdate(roomId: string) {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)
  
  // Call the Postgres function we defined in SQL
  const { error } = await supabase.rpc('simulate_game_stats' as any, { target_room_id: roomId } as any)
  
  if (error) {
    console.error('Simulation failed:', error)
    throw error
  }
  
  return { success: true }
}
