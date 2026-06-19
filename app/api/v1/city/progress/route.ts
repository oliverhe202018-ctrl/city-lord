import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    // [P5 Fix] JWT 验签
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('cityId');

    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_city_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('city_id', cityId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user progress:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch progress' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ success: true, data: null });
    }

    // Get user's rank
    const { count: rankCount } = await supabase
      .from('user_city_progress')
      .select('*', { count: 'exact', head: true })
      .eq('city_id', cityId)
      .gt('area_controlled', (data as any).area_controlled || 0);

    const ranking = (rankCount !== null) ? rankCount + 1 : 0;

    const progress = {
      userId: (data as any).user_id,
      cityId: (data as any).city_id,
      level: (data as any).level,
      experience: (data as any).experience,
      experienceProgress: { current: 0, max: 100 },
      tilesCaptured: (data as any).tiles_captured,
      areaControlled: (data as any).area_controlled,
      ranking: ranking,
      reputation: (data as any).reputation,
      completedChallenges: [],
      unlockedAchievements: [],
      lastActiveAt: (data as any).last_active_at,
      joinedAt: (data as any).joined_at
    };

    return NextResponse.json({ success: true, data: progress });
  } catch (error: any) {
    console.error('[GET /api/v1/city/progress] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
