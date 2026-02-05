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
      badges: {
        Row: {
          category: string | null
          code: string
          condition_value: number | null
          description: string | null
          icon_name: string | null
          id: string
          name: string
          tier: string | null
        }
        Insert: {
          category?: string | null
          code: string
          condition_value?: number | null
          description?: string | null
          icon_name?: string | null
          id?: string
          name: string
          tier?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          condition_value?: number | null
          description?: string | null
          icon_name?: string | null
          id?: string
          name?: string
          tier?: string | null
        }
        Relationships: []
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
      club_members: {
        Row: {
          club_id: string
          joined_at: string
          role: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          joined_at?: string
          role?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          joined_at?: string
          role?: string | null
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
      clubs: {
        Row: {
          audit_reason: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string | null
          status: Database["public"]["Enums"]["club_status"] | null
        }
        Insert: {
          audit_reason?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["club_status"] | null
        }
        Update: {
          audit_reason?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["club_status"] | null
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
      messages: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string | null
          user_id?: string | null
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
          target_value?: number | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          club_id: string | null
          coins: number | null
          created_at: string
          current_exp: number | null
          faction: string | null
          fill_color: string | null
          id: string
          invited_by: string | null
          last_faction_change_at: string | null
          level: number | null
          max_exp: number | null
          max_stamina: number | null
          nickname: string | null
          path_color: string | null
          stamina: number | null
          total_area: number | null
          total_distance_km: number | null
          updated_at: string
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          club_id?: string | null
          coins?: number | null
          created_at?: string
          current_exp?: number | null
          faction?: string | null
          fill_color?: string | null
          id: string
          invited_by?: string | null
          last_faction_change_at?: string | null
          level?: number | null
          max_exp?: number | null
          max_stamina?: number | null
          nickname?: string | null
          path_color?: string | null
          stamina?: number | null
          total_area?: number | null
          total_distance_km?: number | null
          updated_at?: string
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          club_id?: string | null
          coins?: number | null
          created_at?: string
          current_exp?: number | null
          faction?: string | null
          fill_color?: string | null
          id?: string
          invited_by?: string | null
          last_faction_change_at?: string | null
          level?: number | null
          max_exp?: number | null
          max_stamina?: number | null
          nickname?: string | null
          path_color?: string | null
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
        ]
      }
      room_participants: {
        Row: {
          growth_rate: number | null
          joined_at: string
          lost_lands: number | null
          rivals_defeated: number | null
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
          created_at: string
          host_id: string | null
          id: string
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
          created_at?: string
          host_id?: string | null
          id?: string
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
          created_at?: string
          host_id?: string | null
          id?: string
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
      territories: {
        Row: {
          captured_at: string | null
          city_id: string
          health: number | null
          id: string
          last_maintained_at: string | null
          level: number | null
          owner_id: string
        }
        Insert: {
          captured_at?: string | null
          city_id: string
          health?: number | null
          id: string
          last_maintained_at?: string | null
          level?: number | null
          owner_id: string
        }
        Update: {
          captured_at?: string | null
          city_id?: string
          health?: number | null
          id?: string
          last_maintained_at?: string | null
          level?: number | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "territories_owner_id_fkey"
            columns: ["owner_id"]
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
        Relationships: []
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_mission_reward_rpc: {
        Args: { p_mission_id: string; p_user_id: string }
        Returns: Json
      }
      claim_territory: {
        Args: { p_cell_id: string; p_city_id: string }
        Returns: Json
      }
      decay_territories_daily: { Args: never; Returns: undefined }
      get_dashboard_summary: { Args: never; Returns: Json }
      get_faction_stats: {
        Args: never
        Returns: {
          faction_name: string
          member_count: number
        }[]
      }
      get_faction_stats_rpc: { Args: never; Returns: Json }
      get_user_growth_trend: {
        Args: never
        Returns: {
          report_date: string
          user_count: number
        }[]
      }
      increment_user_tiles: {
        Args: { p_city_id: string; p_user_id: string }
        Returns: undefined
      }
      init_user_game_data: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      process_referral: {
        Args: { new_user_id: string; referrer_id: string }
        Returns: Json
      }
      simulate_game_stats: {
        Args: { target_room_id: string }
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