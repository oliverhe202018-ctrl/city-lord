import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';

// ⚡️ 核心优化：外置 unstable_cache，分离纯净的聚合查询
const getCachedCityStats = unstable_cache(
  async (cityId: string) => {
    // 1. Count total players in this city
    const totalPlayers = await prisma.user_city_progress.count({
      where: { city_id: cityId }
    });

    // 2. Count active players
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const activePlayers = await prisma.user_city_progress.count({
      where: {
        city_id: cityId,
        last_active_at: { gt: lastWeek }
      }
    });

    // 3. Count total territories captured
    const totalTiles = await prisma.territories.count({
      where: { city_id: cityId }
    });

    const totalAreaAggregate = await prisma.territories.aggregate({
      where: { city_id: cityId },
      _sum: { area_m2_exact: true }
    });
    const totalArea = (totalAreaAggregate._sum.area_m2_exact || 0) / 1_000_000;

    return {
      totalPlayers,
      activePlayers,
      totalArea: parseFloat(totalArea.toFixed(2)),
      totalTiles
    };
  },
  ['city-stats-agg'],
  { revalidate: 60, tags: ['city-stats'] }
);

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

    const stats = await getCachedCityStats(cityId);
    return NextResponse.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[GET /api/v1/city/stats] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch city stats' },
      { status: 500 }
    );
  }
}
