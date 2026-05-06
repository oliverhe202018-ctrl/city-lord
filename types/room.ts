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
  participants?: any[] // Extended field for UI
  invite_code?: string
  allow_chat?: boolean
  allow_imports?: boolean
  allow_member_invite?: boolean
  avatar_url?: string | null
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
