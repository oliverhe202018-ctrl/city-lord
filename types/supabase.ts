export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          nickname: string | null
          avatar_url: string | null
          level: number
          current_exp: number
          max_exp: number
          stamina: number
          max_stamina: number
          total_area: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nickname?: string | null
          avatar_url?: string | null
          level?: number
          current_exp?: number
          max_exp?: number
          stamina?: number
          max_stamina?: number
          total_area?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nickname?: string | null
          avatar_url?: string | null
          level?: number
          current_exp?: number
          max_exp?: number
          stamina?: number
          max_stamina?: number
          total_area?: number
          created_at?: string
          updated_at?: string
        }
      }
      clubs: {
        Row: {
          id: string
          name: string
          description: string | null
          owner_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string | null
          created_at?: string
        }
      }
      challenges: {
        Row: {
          id: string
          type: 'race' | 'territory' | 'distance'
          creator_id: string
          target_id: string
          distance: number | null
          duration: string | null
          reward_xp: number
          status: 'pending' | 'accepted' | 'completed' | 'declined' | 'expired'
          created_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          type: 'race' | 'territory' | 'distance'
          creator_id: string
          target_id: string
          distance?: number | null
          duration?: string | null
          reward_xp?: number
          status?: 'pending' | 'accepted' | 'completed' | 'declined' | 'expired'
          created_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          type?: 'race' | 'territory' | 'distance'
          creator_id?: string
          target_id?: string
          distance?: number | null
          duration?: string | null
          reward_xp?: number
          status?: 'pending' | 'accepted' | 'completed' | 'declined' | 'expired'
          created_at?: string
          expires_at?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          sender_id: string | null
          receiver_id: string
          content: string
          type: 'text' | 'system' | 'challenge'
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sender_id?: string | null
          receiver_id: string
          content: string
          type?: 'text' | 'system' | 'challenge'
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string | null
          receiver_id?: string
          content?: string
          type?: 'text' | 'system' | 'challenge'
          is_read?: boolean
          created_at?: string
        }
      }
    }
  }
}
