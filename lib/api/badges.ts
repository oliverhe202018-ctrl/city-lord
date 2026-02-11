import { createClient } from "@/lib/supabase/client";

export interface BadgeType {
  id: string;
  code: string;
  name: string;
  description: string;
  icon_url: string;
  category: string;
  tier: string;
  condition_value?: number;
  requirement_type?: string;
  requirement_value?: number;
}

export interface UserEarnedBadge {
  badge_id: string;
  earned_at: string;
}

/**
 * Fetch all badge definitions from the backend
 */
export async function fetchAllBadgeTypes(): Promise<BadgeType[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('condition_value', { ascending: true });

  if (error) {
    console.error('Error fetching badge types:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description || '',
    icon_url: item.icon_path || item.icon_name || '', // Support both legacy and new fields
    category: item.category || 'general',
    tier: item.tier || 'bronze',
    condition_value: item.condition_value || 0,
    requirement_type: item.requirement_type || '',
    requirement_value: Number(item.requirement_value) || 0
  }));
}

/**
 * Fetch earned badges for a specific user
 */
export async function fetchUserEarnedBadges(userId: string): Promise<UserEarnedBadge[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching user earned badges:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    badge_id: item.badge_id,
    earned_at: item.earned_at
  }));
}
