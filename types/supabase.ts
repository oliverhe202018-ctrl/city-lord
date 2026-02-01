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
          coins: number
          total_distance_km: number
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
          coins?: number
          total_distance_km?: number
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
          coins?: number
          total_distance_km?: number
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
          avatar_url: string | null
          level: string
          rating: number
          member_count: number
          territory: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          owner_id?: string | null
          avatar_url?: string | null
          level?: string
          rating?: number
          member_count?: number
          territory?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          owner_id?: string | null
          avatar_url?: string | null
          level?: string
          rating?: number
          member_count?: number
          territory?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      club_members: {
        Row: {
          club_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member'
          status: 'pending' | 'active'
          joined_at: string
        }
        Insert: {
          club_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member'
          status?: 'pending' | 'active'
          joined_at?: string
        }
        Update: {
          club_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member'
          status?: 'pending' | 'active'
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      friendships: {
        Row: {
          user_id: string
          friend_id: string
          status: 'pending' | 'accepted' | 'blocked'
          created_at: string
        }
        Insert: {
          user_id: string
          friend_id: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
        }
        Update: {
          user_id?: string
          friend_id?: string
          status?: 'pending' | 'accepted' | 'blocked'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      missions: {
        Row: {
          id: string
          title: string
          description: string
          type: string
          target: number
          reward_coins: number
          reward_experience: number
          frequency: 'one_time' | 'daily' | 'weekly' | 'achievement'
        }
        Insert: {
          id?: string
          title: string
          description: string
          type: string
          target: number
          reward_coins?: number
          reward_experience?: number
          frequency?: 'one_time' | 'daily' | 'weekly' | 'achievement'
        }
        Update: {
          id?: string
          title?: string
          description?: string
          type?: string
          target?: number
          reward_coins?: number
          reward_experience?: number
          frequency?: 'one_time' | 'daily' | 'weekly' | 'achievement'
        }
      }
      user_missions: {
        Row: {
          user_id: string
          mission_id: string
          status: 'todo' | 'in-progress' | 'completed' | 'claimed'
          progress: number
          updated_at: string
          claimed_at: string | null
        }
        Insert: {
          user_id: string
          mission_id: string
          status?: 'todo' | 'in-progress' | 'completed' | 'claimed'
          progress?: number
          updated_at?: string
          claimed_at?: string | null
        }
        Update: {
          user_id?: string
          mission_id?: string
          status?: 'todo' | 'in-progress' | 'completed' | 'claimed'
          progress?: number
          updated_at?: string
          claimed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          }
        ]
      }
      user_city_progress: {
        Row: {
          user_id: string
          city_id: string
          level: number
          experience: number
          tiles_captured: number
          area_controlled: number
          reputation: number
          last_active_at: string
          joined_at: string
        }
        Insert: {
          user_id: string
          city_id: string
          level?: number
          experience?: number
          tiles_captured?: number
          area_controlled?: number
          reputation?: number
          last_active_at?: string
          joined_at?: string
        }
        Update: {
          user_id?: string
          city_id?: string
          level?: number
          experience?: number
          tiles_captured?: number
          area_controlled?: number
          reputation?: number
          last_active_at?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_city_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      territories: {
        Row: {
          id: string
          city_id: string
          owner_id: string
          captured_at: string
        }
        Insert: {
          id: string
          city_id: string
          owner_id: string
          captured_at?: string
        }
        Update: {
          id?: string
          city_id?: string
          owner_id?: string
          captured_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      badges: {
        Row: {
          id: string
          code: string
          name: string
          description: string
          icon_name: string
          category: 'exploration' | 'endurance' | 'conquest' | 'hidden'
          condition_value: number
          tier: 'bronze' | 'silver' | 'gold' | 'platinum'
        }
        Insert: {
          id?: string
          code: string
          name: string
          description: string
          icon_name: string
          category: 'exploration' | 'endurance' | 'conquest' | 'hidden'
          condition_value: number
          tier: 'bronze' | 'silver' | 'gold' | 'platinum'
        }
        Update: {
          id?: string
          code?: string
          name?: string
          description?: string
          icon_name?: string
          category?: 'exploration' | 'endurance' | 'conquest' | 'hidden'
          condition_value?: number
          tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
        }
      }
      user_badges: {
        Row: {
          user_id: string
          badge_id: string
          earned_at: string
        }
        Insert: {
          user_id: string
          badge_id: string
          earned_at?: string
        }
        Update: {
          user_id?: string
          badge_id?: string
          earned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      achievements: {
        Row: {
          id: string
          name: string
          description: string
          type: string
          tier: number
          condition_type: string
          condition_threshold: number
          reward_badge: string | null
          reward_exp: number
          reward_points: number
        }
        Insert: {
          id?: string
          name: string
          description: string
          type: string
          tier: number
          condition_type: string
          condition_threshold: number
          reward_badge?: string | null
          reward_exp?: number
          reward_points?: number
        }
        Update: {
          id?: string
          name?: string
          description?: string
          type?: string
          tier?: number
          condition_type?: string
          condition_threshold?: number
          reward_badge?: string | null
          reward_exp?: number
          reward_points?: number
        }
      }
      user_achievements: {
        Row: {
          user_id: string
          achievement_id: string
          progress: number
          is_completed: boolean
          completed_at: string | null
        }
        Insert: {
          user_id: string
          achievement_id: string
          progress?: number
          is_completed?: boolean
          completed_at?: string | null
        }
        Update: {
          user_id?: string
          achievement_id?: string
          progress?: number
          is_completed?: boolean
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    Functions: {
      increment_user_tiles: {
        Args: {
          p_user_id: string
          p_city_id: string
        }
        Returns: void
      }
      init_user_game_data: {
        Args: {
          target_user_id: string
        }
        Returns: void
      }
    }
    Views: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
