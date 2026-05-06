export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      _territories_backup_20260301: {
        Row: {
          captured_at: string | null
          city_id: string | null
          geojson: unknown
          health: number | null
          id: string | null
          last_maintained_at: string | null
          level: number | null
          owner_id: string | null
          status: string | null
        }
        Insert: {
          captured_at?: string | null
          city_id?: string | null
          geojson?: unknown
          health?: number | null
          id?: string | null
          last_maintained_at?: string | null
          level?: number | null
          owner_id?: string | null
          status?: string | null
        }
        Update: {
          captured_at?: string | null
          city_id?: string | null
          geojson?: unknown
          health?: number | null
          id?: string | null
          last_maintained_at?: string | null
          level?: number | null
          owner_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      activity_comments: {
        Row: {
          activity_type: string
          content: string
          created_at: string
          id: string
          target_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          content: string
          created_at?: string
          id?: string
          target_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          content?: string
          created_at?: string
          id?: string
          target_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_likes: {
        Row: {
          activity_type: string
          created_at: string
          id: string
          target_id: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          id?: string
          target_id: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          id?: string
          target_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: string | null
          id: string
          target_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
        }
        Relationships: []
      }
      app_admins: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          role?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      backgrounds: {
        Row: {
          condition_type: string | null
          condition_value: number | null
          created_at: string
          id: string
          image_url: string
          is_default: boolean
          name: string
          preview_url: string | null
          price_coins: number | null
        }
        Insert: {
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string
          id?: string
          image_url: string
          is_default?: boolean
          name: string
          preview_url?: string | null
          price_coins?: number | null
        }
        Update: {
          condition_type?: string | null
          condition_value?: number | null
          created_at?: string
          id?: string
          image_url?: string
          is_default?: boolean
          name?: string
          preview_url?: string | null
          price_coins?: number | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          category: string | null
          code: string
          condition_value: number | null
          description: string | null
          icon_name: string | null
          icon_path: string | null
          id: string
          level: string | null
          name: string
          requirement_description: string | null
          requirement_type: string | null
          requirement_value: number | null
          tier: string | null
        }
        Insert: {
          category?: string | null
          code: string
          condition_value?: number | null
          description?: string | null
          icon_name?: string | null
          icon_path?: string | null
          id?: string
          level?: string | null
          name: string
          requirement_description?: string | null
          requirement_type?: string | null
          requirement_value?: number | null
          tier?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          condition_value?: number | null
          description?: string | null
          icon_name?: string | null
          icon_path?: string | null
          id?: string
          level?: string | null
          name?: string
          requirement_description?: string | null
          requirement_type?: string | null
          requirement_value?: number | null
          tier?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          creator_id: string
          distance: number | null
          duration: string | null
          expires_at: string | null
          id: string
          reward_xp: number | null
          status: string | null
          target_id: string
          type: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          distance?: number | null
          duration?: string | null
          expires_at?: string | null
          id?: string
          reward_xp?: number | null
          status?: string | null
          target_id: string
          type: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          distance?: number | null
          duration?: string | null
          expires_at?: string | null
          id?: string
          reward_xp?: number | null
          status?: string | null
          target_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenges_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_activities: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          description: string
          end_time: string
          id: string
          location: string | null
          max_participants: number | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          description?: string
          end_time: string
          id?: string
          location?: string | null
          max_participants?: number | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          description?: string
          end_time?: string
          id?: string
          location?: string | null
          max_participants?: number | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_activities_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_activity_registrations: {
        Row: {
          activity_id: string
          club_id: string
          id: string
          registered_at: string
          score: number
          status: string
          user_id: string
        }
        Insert: {
          activity_id: string
          club_id: string
          id?: string
          registered_at?: string
          score?: number
          status?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          club_id?: string
          id?: string
          registered_at?: string
          score?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_activity_registrations_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "club_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_activity_registrations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_activity_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_channels: {
        Row: {
          club_id: string
          created_at: string
          id: string
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "club_channels_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: string
          joined_at: string
          role: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          joined_at?: string
          role?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          joined_at?: string
          role?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_messages: {
        Row: {
          audio_url: string | null
          channel_id: string
          club_id: string
          content: string
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          id: string
          message_type: string | null
          mime_type: string | null
          sender_id: string
          size_bytes: number | null
          waveform: Json | null
        }
        Insert: {
          audio_url?: string | null
          channel_id: string
          club_id: string
          content: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          id?: string
          message_type?: string | null
          mime_type?: string | null
          sender_id: string
          size_bytes?: number | null
          waveform?: Json | null
        }
        Update: {
          audio_url?: string | null
          channel_id?: string
          club_id?: string
          content?: string
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          id?: string
          message_type?: string | null
          mime_type?: string | null
          sender_id?: string
          size_bytes?: number | null
          waveform?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "club_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "club_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_territory_stats: {
        Row: {
          club_id: string
          last_synced_event_id: number
          total_area: number
          total_tiles: number
          updated_at: string
        }
        Insert: {
          club_id: string
          last_synced_event_id?: number
          total_area?: number
          total_tiles?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          last_synced_event_id?: number
          total_area?: number
          total_tiles?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_territory_stats_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: true
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          audit_reason: string | null
          avatar_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          level: string | null
          member_count: number | null
          name: string
          owner_id: string | null
          province: string | null
          rating: number | null
          status: Database["public"]["Enums"]["club_status"] | null
          territory: string | null
          total_area: number | null
        }
        Insert: {
          audit_reason?: string | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          level?: string | null
          member_count?: number | null
          name: string
          owner_id?: string | null
          province?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["club_status"] | null
          territory?: string | null
          total_area?: number | null
        }
        Update: {
          audit_reason?: string | null
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          level?: string | null
          member_count?: number | null
          name?: string
          owner_id?: string | null
          province?: string | null
          rating?: number | null
          status?: Database["public"]["Enums"]["club_status"] | null
          territory?: string | null
          total_area?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clubs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      DailyStat: {
        Row: {
          blueCount: number
          createdAt: string
          date: string
          id: string
          redCount: number
          totalTerritories: number
        }
        Insert: {
          blueCount: number
          createdAt?: string
          date: string
          id: string
          redCount: number
          totalTerritories: number
        }
        Update: {
          blueCount?: number
          createdAt?: string
          date?: string
          id?: string
          redCount?: number
          totalTerritories?: number
        }
        Relationships: []
      }
      device_tokens: {
        Row: {
          id: string
          platform: string | null
          provider: string | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string | null
          provider?: string | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          platform?: string | null
          provider?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      faction_balance_configs: {
        Row: {
          auto_balance_enabled: boolean | null
          id: string
          imbalance_threshold: number | null
          manual_buff_target: string | null
          underdog_multiplier: number | null
          updated_at: string | null
        }
        Insert: {
          auto_balance_enabled?: boolean | null
          id?: string
          imbalance_threshold?: number | null
          manual_buff_target?: string | null
          underdog_multiplier?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_balance_enabled?: boolean | null
          id?: string
          imbalance_threshold?: number | null
          manual_buff_target?: string | null
          underdog_multiplier?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      faction_stats_snapshot: {
        Row: {
          blue_area: number
          id: string
          red_area: number
          updated_at: string
        }
        Insert: {
          blue_area?: number
          id: string
          red_area?: number
          updated_at?: string
        }
        Update: {
          blue_area?: number
          id?: string
          red_area?: number
          updated_at?: string
        }
        Relationships: []
      }
      faction_territory_stats: {
        Row: {
          faction_name: string
          last_synced_event_id: number
          total_area: number
          total_tiles: number
          updated_at: string
        }
        Insert: {
          faction_name: string
          last_synced_event_id?: number
          total_area?: number
          total_tiles?: number
          updated_at?: string
        }
        Update: {
          faction_name?: string
          last_synced_event_id?: number
          total_area?: number
          total_tiles?: number
          updated_at?: string
        }
        Relationships: []
      }
      FactionStatsCache: {
        Row: {
          blue_area: number
          id: number
          red_area: number
          updated_at: string
        }
        Insert: {
          blue_area?: number
          id?: number
          red_area?: number
          updated_at?: string
        }
        Update: {
          blue_area?: number
          id?: number
          red_area?: number
          updated_at?: string
        }
        Relationships: []
      }
      friend_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          expired_at: string | null
          id: string
          invite_link: string
          invitee_user_id: string | null
          inviter_user_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          invite_link: string
          invitee_user_id?: string | null
          inviter_user_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expired_at?: string | null
          id?: string
          invite_link?: string
          invitee_user_id?: string | null
          inviter_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_invitations_invitee_fkey"
            columns: ["invitee_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_invitations_inviter_fkey"
            columns: ["inviter_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_snapshots: {
        Row: {
          dimension: string
          generated_at: string
          id: string
          rank_data: Json
          season_id: string
        }
        Insert: {
          dimension: string
          generated_at?: string
          id?: string
          rank_data: Json
          season_id: string
        }
        Update: {
          dimension?: string
          generated_at?: string
          id?: string
          rank_data?: Json
          season_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          audio_url: string | null
          content: string | null
          created_at: string | null
          duration_ms: number | null
          id: string
          is_read: boolean | null
          mime_type: string | null
          sender_id: string | null
          size_bytes: number | null
          type: string | null
          user_id: string | null
          waveform: Json | null
        }
        Insert: {
          audio_url?: string | null
          content?: string | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          is_read?: boolean | null
          mime_type?: string | null
          sender_id?: string | null
          size_bytes?: number | null
          type?: string | null
          user_id?: string | null
          waveform?: Json | null
        }
        Update: {
          audio_url?: string | null
          content?: string | null
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          is_read?: boolean | null
          mime_type?: string | null
          sender_id?: string | null
          size_bytes?: number | null
          type?: string | null
          user_id?: string | null
          waveform?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_completions: {
        Row: {
          completed_at: string | null
          id: string
          mission_id: string
          mission_title: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          mission_id: string
          mission_title?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          mission_id?: string
          mission_title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mission_configs: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          is_active: boolean | null
          points_reward: number
          title: string
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          points_reward?: number
          title: string
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_active?: boolean | null
          points_reward?: number
          title?: string
        }
        Relationships: []
      }
      missions: {
        Row: {
          created_at: string | null
          description: string | null
          frequency: string | null
          id: string
          reward_amount: number | null
          reward_coins: number | null
          reward_experience: number | null
          reward_xp: number | null
          target: number | null
          target_count: number | null
          target_value: number | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          reward_amount?: number | null
          reward_coins?: number | null
          reward_experience?: number | null
          reward_xp?: number | null
          target?: number | null
          target_count?: number | null
          target_value?: number | null
          title: string
          type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          reward_amount?: number | null
          reward_coins?: number | null
          reward_experience?: number | null
          reward_xp?: number | null
          target?: number | null
          target_count?: number | null
          target_value?: number | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          post_id: string
          status: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          post_id: string
          status?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string | null
          created_at: string
          id: string
          media_urls: string[] | null
          source_id: string | null
          source_type: string
          status: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          source_id?: string | null
          source_type: string
          status?: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: string[] | null
          source_id?: string | null
          source_type?: string
          status?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_likes: {
        Row: {
          created_at: string
          id: string
          liker_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liker_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liker_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_likes_liker_id_fkey"
            columns: ["liker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_direct_messages: string | null
          allow_recommendations: boolean | null
          api_key: string | null
          avatar_url: string | null
          background_url: string | null
          badges: string[] | null
          club_id: string | null
          coins: number | null
          cover_url: string | null
          created_at: string
          current_exp: number | null
          faction: string | null
          fill_color: string | null
          fill_opacity: number | null
          id: string
          invited_by: string | null
          is_profile_public: boolean
          last_faction_change_at: string | null
          last_social_read_at: string | null
          level: number | null
          max_exp: number | null
          max_stamina: number | null
          nickname: string | null
          path_color: string | null
          province: string | null
          referral_code: string | null
          referrer_id: string | null
          stamina: number | null
          total_area: number | null
          total_distance_km: number | null
          updated_at: string
          xp: number | null
        }
        Insert: {
          allow_direct_messages?: string | null
          allow_recommendations?: boolean | null
          api_key?: string | null
          avatar_url?: string | null
          background_url?: string | null
          badges?: string[] | null
          club_id?: string | null
          coins?: number | null
          cover_url?: string | null
          created_at?: string
          current_exp?: number | null
          faction?: string | null
          fill_color?: string | null
          fill_opacity?: number | null
          id?: string
          invited_by?: string | null
          is_profile_public?: boolean
          last_faction_change_at?: string | null
          last_social_read_at?: string | null
          level?: number | null
          max_exp?: number | null
          max_stamina?: number | null
          nickname?: string | null
          path_color?: string | null
          province?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          stamina?: number | null
          total_area?: number | null
          total_distance_km?: number | null
          updated_at?: string
          xp?: number | null
        }
        Update: {
          allow_direct_messages?: string | null
          allow_recommendations?: boolean | null
          api_key?: string | null
          avatar_url?: string | null
          background_url?: string | null
          badges?: string[] | null
          club_id?: string | null
          coins?: number | null
          cover_url?: string | null
          created_at?: string
          current_exp?: number | null
          faction?: string | null
          fill_color?: string | null
          fill_opacity?: number | null
          id?: string
          invited_by?: string | null
          is_profile_public?: boolean
          last_faction_change_at?: string | null
          last_social_read_at?: string | null
          level?: number | null
          max_exp?: number | null
          max_stamina?: number | null
          nickname?: string | null
          path_color?: string | null
          province?: string | null
          referral_code?: string | null
          referrer_id?: string | null
          stamina?: number | null
          total_area?: number | null
          total_distance_km?: number | null
          updated_at?: string
          xp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ProvinceStat: {
        Row: {
          id: number
          provinceName: string
          totalTerritoryArea: number
          updatedAt: string
        }
        Insert: {
          id?: number
          provinceName: string
          totalTerritoryArea: number
          updatedAt: string
        }
        Update: {
          id?: number
          provinceName?: string
          totalTerritoryArea?: number
          updatedAt?: string
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          audio_url: string | null
          content: string
          created_at: string | null
          duration_ms: number | null
          id: string
          message_type: string | null
          mime_type: string | null
          room_id: string
          size_bytes: number | null
          user_id: string
          waveform: Json | null
        }
        Insert: {
          audio_url?: string | null
          content: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          message_type?: string | null
          mime_type?: string | null
          room_id: string
          size_bytes?: number | null
          user_id: string
          waveform?: Json | null
        }
        Update: {
          audio_url?: string | null
          content?: string
          created_at?: string | null
          duration_ms?: number | null
          id?: string
          message_type?: string | null
          mime_type?: string | null
          room_id?: string
          size_bytes?: number | null
          user_id?: string
          waveform?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          growth_rate: number | null
          joined_at: string
          lost_lands: number | null
          rivals_defeated: number | null
          role: string | null
          room_id: string
          status: string | null
          stolen_lands: number | null
          territory_area: number | null
          territory_ratio: number | null
          total_score: number | null
          user_id: string
        }
        Insert: {
          growth_rate?: number | null
          joined_at?: string
          lost_lands?: number | null
          rivals_defeated?: number | null
          role?: string | null
          room_id: string
          status?: string | null
          stolen_lands?: number | null
          territory_area?: number | null
          territory_ratio?: number | null
          total_score?: number | null
          user_id: string
        }
        Update: {
          growth_rate?: number | null
          joined_at?: string
          lost_lands?: number | null
          rivals_defeated?: number | null
          role?: string | null
          room_id?: string
          status?: string | null
          stolen_lands?: number | null
          territory_area?: number | null
          territory_ratio?: number | null
          total_score?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          allow_chat: boolean | null
          allow_imports: boolean | null
          allow_member_invite: boolean | null
          avatar_url: string | null
          category: string | null
          created_at: string
          description: string | null
          host_id: string | null
          icon_url: string | null
          id: string
          invite_code: string | null
          is_banned: boolean | null
          is_private: boolean | null
          max_participants: number | null
          name: string
          password: string | null
          status: string | null
          target_distance_km: number | null
          target_duration_minutes: number | null
        }
        Insert: {
          allow_chat?: boolean | null
          allow_imports?: boolean | null
          allow_member_invite?: boolean | null
          avatar_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          host_id?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string | null
          is_banned?: boolean | null
          is_private?: boolean | null
          max_participants?: number | null
          name: string
          password?: string | null
          status?: string | null
          target_distance_km?: number | null
          target_duration_minutes?: number | null
        }
        Update: {
          allow_chat?: boolean | null
          allow_imports?: boolean | null
          allow_member_invite?: boolean | null
          avatar_url?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          host_id?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string | null
          is_banned?: boolean | null
          is_private?: boolean | null
          max_participants?: number | null
          name?: string
          password?: string | null
          status?: string | null
          target_distance_km?: number | null
          target_duration_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_plans: {
        Row: {
          capture_area: number | null
          created_at: string | null
          distance: number | null
          estimated_time: number | null
          geometry: Json | null
          id: string
          name: string | null
          user_id: string
          waypoints: Json | null
        }
        Insert: {
          capture_area?: number | null
          created_at?: string | null
          distance?: number | null
          estimated_time?: number | null
          geometry?: Json | null
          id?: string
          name?: string | null
          user_id: string
          waypoints?: Json | null
        }
        Update: {
          capture_area?: number | null
          created_at?: string | null
          distance?: number | null
          estimated_time?: number | null
          geometry?: Json | null
          id?: string
          name?: string | null
          user_id?: string
          waypoints?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "route_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          area: number
          club_id: string | null
          created_at: string | null
          distance: number | null
          duration: number
          id: string
          idempotency_key: string | null
          path: Json | null
          photo_url: string | null
          polygons: Json | null
          province: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          area?: number
          club_id?: string | null
          created_at?: string | null
          distance?: number | null
          duration?: number
          id?: string
          idempotency_key?: string | null
          path?: Json | null
          photo_url?: string | null
          polygons?: Json | null
          province?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          area?: number
          club_id?: string | null
          created_at?: string | null
          distance?: number | null
          duration?: number
          id?: string
          idempotency_key?: string | null
          path?: Json | null
          photo_url?: string | null
          polygons?: Json | null
          province?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_workouts: {
        Row: {
          day_offset: number | null
          id: string
          is_completed: boolean | null
          plan_id: string
          target_distance: number | null
          target_pace: string | null
        }
        Insert: {
          day_offset?: number | null
          id?: string
          is_completed?: boolean | null
          plan_id: string
          target_distance?: number | null
          target_pace?: string | null
        }
        Update: {
          day_offset?: number | null
          id?: string
          is_completed?: boolean | null
          plan_id?: string
          target_distance?: number | null
          target_pace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          is_active: boolean
          name: string
          start_date: string
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          is_active?: boolean
          name: string
          start_date: string
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      store_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          inventory_count: number
          is_active: boolean
          name: string
          price: number
          purchase_limit_per_user: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory_count?: number
          is_active?: boolean
          name: string
          price: number
          purchase_limit_per_user?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          inventory_count?: number
          is_active?: boolean
          name?: string
          price?: number
          purchase_limit_per_user?: number
        }
        Relationships: []
      }
      suspicious_location_report: {
        Row: {
          created_at: string | null
          id: string
          location: Json
          reported_speed: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          location: Json
          reported_speed: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          location?: Json
          reported_speed?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          code: string
          condition: string
          created_at: string
          description: string
          id: string
          is_visible: boolean
          reward: Json
          target_value: number
          title: string
          type: string
          unit: string
        }
        Insert: {
          code: string
          condition: string
          created_at?: string
          description: string
          id?: string
          is_visible?: boolean
          reward: Json
          target_value: number
          title: string
          type: string
          unit: string
        }
        Update: {
          code?: string
          condition?: string
          created_at?: string
          description?: string
          id?: string
          is_visible?: boolean
          reward?: Json
          target_value?: number
          title?: string
          type?: string
          unit?: string
        }
        Relationships: []
      }
      territories: {
        Row: {
          captured_at: string | null
          city_id: string
          geojson: unknown
          health: number | null
          id: string
          last_maintained_at: string | null
          last_owner_change_at: string | null
          level: number | null
          neutral_until: string | null
          owner_change_count: number | null
          owner_club_id: string | null
          owner_faction: string | null
          owner_id: string
          status: string | null
        }
        Insert: {
          captured_at?: string | null
          city_id: string
          geojson?: unknown
          health?: number | null
          id: string
          last_maintained_at?: string | null
          last_owner_change_at?: string | null
          level?: number | null
          neutral_until?: string | null
          owner_change_count?: number | null
          owner_club_id?: string | null
          owner_faction?: string | null
          owner_id: string
          status?: string | null
        }
        Update: {
          captured_at?: string | null
          city_id?: string
          geojson?: unknown
          health?: number | null
          id?: string
          last_maintained_at?: string | null
          last_owner_change_at?: string | null
          level?: number | null
          neutral_until?: string | null
          owner_change_count?: number | null
          owner_club_id?: string | null
          owner_faction?: string | null
          owner_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "territories_owner_club_id_fkey"
            columns: ["owner_club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "territories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_attacks: {
        Row: {
          attacker_id: string
          created_at: string | null
          defender_id: string
          id: string
          territory_id: string
          territory_name: string | null
        }
        Insert: {
          attacker_id: string
          created_at?: string | null
          defender_id: string
          id?: string
          territory_id: string
          territory_name?: string | null
        }
        Update: {
          attacker_id?: string
          created_at?: string | null
          defender_id?: string
          id?: string
          territory_id?: string
          territory_name?: string | null
        }
        Relationships: []
      }
      territory_events: {
        Row: {
          action_id: string | null
          created_at: string | null
          event_type: string
          id: number
          new_club_id: string | null
          new_faction: string | null
          new_owner_id: string | null
          old_club_id: string | null
          old_faction: string | null
          old_owner_id: string | null
          processed_at: string | null
          processed_for_stats: boolean | null
          processor_version: string | null
          source_request_id: string | null
          territory_id: string
          user_id: string | null
        }
        Insert: {
          action_id?: string | null
          created_at?: string | null
          event_type: string
          id?: number
          new_club_id?: string | null
          new_faction?: string | null
          new_owner_id?: string | null
          old_club_id?: string | null
          old_faction?: string | null
          old_owner_id?: string | null
          processed_at?: string | null
          processed_for_stats?: boolean | null
          processor_version?: string | null
          source_request_id?: string | null
          territory_id: string
          user_id?: string | null
        }
        Update: {
          action_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: number
          new_club_id?: string | null
          new_faction?: string | null
          new_owner_id?: string | null
          old_club_id?: string | null
          old_faction?: string | null
          old_owner_id?: string | null
          processed_at?: string | null
          processed_for_stats?: boolean | null
          processor_version?: string | null
          source_request_id?: string | null
          territory_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      territory_hp_logs: {
        Row: {
          attack_date: string
          attacked_at: string | null
          attacker_id: string
          damage: number
          id: string
          territory_id: string
        }
        Insert: {
          attack_date?: string
          attacked_at?: string | null
          attacker_id: string
          damage: number
          id?: string
          territory_id: string
        }
        Update: {
          attack_date?: string
          attacked_at?: string | null
          attacker_id?: string
          damage?: number
          id?: string
          territory_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territory_hp_logs_territory_id_fkey"
            columns: ["territory_id"]
            isOneToOne: false
            referencedRelation: "territories"
            referencedColumns: ["id"]
          },
        ]
      }
      territory_reward_penalties: {
        Row: {
          applied_ratio: number
          attacker_club_id: string | null
          attacker_user_id: string
          claim_event_id: number
          created_at: string | null
          defender_user_id: string | null
          id: string
          matched_rule: string
          penalty_enabled_snapshot: boolean
          reason_window: string
          reward_payload_snapshot: Json | null
          source_event_ids: Json | null
          territory_id: string
        }
        Insert: {
          applied_ratio: number
          attacker_club_id?: string | null
          attacker_user_id: string
          claim_event_id: number
          created_at?: string | null
          defender_user_id?: string | null
          id?: string
          matched_rule: string
          penalty_enabled_snapshot?: boolean
          reason_window: string
          reward_payload_snapshot?: Json | null
          source_event_ids?: Json | null
          territory_id: string
        }
        Update: {
          applied_ratio?: number
          attacker_club_id?: string | null
          attacker_user_id?: string
          claim_event_id?: number
          created_at?: string | null
          defender_user_id?: string | null
          id?: string
          matched_rule?: string
          penalty_enabled_snapshot?: boolean
          reason_window?: string
          reward_payload_snapshot?: Json | null
          source_event_ids?: Json | null
          territory_id?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string | null
          duration_weeks: number | null
          goal: string | null
          id: string
          level: string | null
          start_date: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          level?: string | null
          start_date?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_weeks?: number | null
          goal?: string | null
          id?: string
          level?: string | null
          start_date?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string | null
          id: string
          unlocked_at: string | null
          user_id: string | null
        }
        Insert: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievement_id?: string | null
          id?: string
          unlocked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_backgrounds: {
        Row: {
          acquired_at: string
          background_id: string
          id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          background_id: string
          id?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          background_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_backgrounds_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "backgrounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_backgrounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
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
          },
        ]
      }
      user_city_progress: {
        Row: {
          area_controlled: number | null
          city_id: string
          experience: number | null
          joined_at: string | null
          last_active_at: string | null
          level: number | null
          reputation: number | null
          score: number | null
          tiles_captured: number | null
          user_id: string
        }
        Insert: {
          area_controlled?: number | null
          city_id: string
          experience?: number | null
          joined_at?: string | null
          last_active_at?: string | null
          level?: number | null
          reputation?: number | null
          score?: number | null
          tiles_captured?: number | null
          user_id: string
        }
        Update: {
          area_controlled?: number | null
          city_id?: string
          experience?: number | null
          joined_at?: string | null
          last_active_at?: string | null
          level?: number | null
          reputation?: number | null
          score?: number | null
          tiles_captured?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_city_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          id: string
          location: unknown
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          location?: unknown
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          location?: unknown
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_missions: {
        Row: {
          claimed_at: string | null
          id: string
          mission_id: string
          progress: number | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          id?: string
          mission_id: string
          progress?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          id?: string
          mission_id?: string
          progress?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_missions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_purchases: {
        Row: {
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          item_id: string
          season_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          item_id: string
          season_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          item_id?: string
          season_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_season_stats: {
        Row: {
          id: string
          rank: number | null
          score: number
          season_id: string
          user_id: string
        }
        Insert: {
          id?: string
          rank?: number | null
          score?: number
          season_id: string
          user_id: string
        }
        Update: {
          id?: string
          rank?: number | null
          score?: number
          season_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_season_stats_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_season_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_task_logs: {
        Row: {
          completed_at: string | null
          id: string
          period_key: string
          reward_coins: number
          reward_xp: number
          run_id: string | null
          task_id: string
          type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          period_key: string
          reward_coins?: number
          reward_xp?: number
          run_id?: string | null
          task_id: string
          type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          period_key?: string
          reward_coins?: number
          reward_xp?: number
          run_id?: string | null
          task_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_task_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          current_value: number
          expires_at: string
          id: string
          status: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          expires_at: string
          id?: string
          status?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_value?: number
          expires_at?: string
          id?: string
          status?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_task_progress_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_task_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      watch_activities: {
        Row: {
          cleaned_points: Json | null
          created_at: string
          error_message: string | null
          external_id: string | null
          id: string
          is_loop: boolean
          loop_distance: number | null
          point_count: number
          raw_data: Json | null
          raw_points: Json
          run_id: string | null
          source: string
          source_app: string | null
          status: string
          summary: Json
          territory_area: number | null
          total_distance: number | null
          user_id: string
        }
        Insert: {
          cleaned_points?: Json | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          is_loop?: boolean
          loop_distance?: number | null
          point_count?: number
          raw_data?: Json | null
          raw_points: Json
          run_id?: string | null
          source?: string
          source_app?: string | null
          status?: string
          summary: Json
          territory_area?: number | null
          total_distance?: number | null
          user_id: string
        }
        Update: {
          cleaned_points?: Json | null
          created_at?: string
          error_message?: string | null
          external_id?: string | null
          id?: string
          is_loop?: boolean
          loop_distance?: number | null
          point_count?: number
          raw_data?: Json | null
          raw_points?: Json
          run_id?: string | null
          source?: string
          source_app?: string | null
          status?: string
          summary?: Json
          territory_area?: number | null
          total_distance?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_activities_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watch_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_cursors: {
        Row: {
          consumer_name: string
          last_event_id: number
          updated_at: string
        }
        Insert: {
          consumer_name: string
          last_event_id?: number
          updated_at?: string
        }
        Update: {
          consumer_name?: string
          last_event_id?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decay_territories_daily: { Args: never; Returns: undefined }
      detach_club_territories: {
        Args: { p_club_id: string; p_user_id: string }
        Returns: undefined
      }
      purge_faction_territories: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      update_user_location_rpc: {
        Args: { p_lat: number; p_lng: number; p_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      club_status: "pending" | "active" | "rejected" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      club_status: ["pending", "active", "rejected", "suspended"],
    },
  },
} as const
