import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

interface CityLeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  level: number;
  avatar: string;
  totalArea: number;
  tilesCaptured: number;
  reputation: number;
}

async function generateLeaderboardData(cityId: string, limit: number): Promise<CityLeaderboardEntry[]> {
  const isGlobal = cityId === 'global';
  
  if (isGlobal) {
    const data = await prisma.profiles.findMany({
      orderBy: { total_area: 'desc' },
      take: limit,
      select: {
        id: true,
        nickname: true,
        avatar_url: true,
        level: true,
        total_area: true
      }
    });

    return data.map((entry, index) => ({
      rank: index + 1,
      userId: entry.id,
      nickname: entry.nickname || 'Unknown',
      level: entry.level || 1,
      avatar: entry.avatar_url || '',
      totalArea: Number(entry.total_area || 0),
      tilesCaptured: 0,
      reputation: 0
    }));
  }

  const data = await prisma.user_city_progress.findMany({
    where: { city_id: cityId },
    select: {
      user_id: true,
      area_controlled: true,
      tiles_captured: true,
      reputation: true,
      profiles: {
        select: {
          nickname: true,
          avatar_url: true,
          level: true
        }
      }
    },
    orderBy: { area_controlled: 'desc' },
    take: limit
  });

  return data.map((entry, index) => ({
    rank: index + 1,
    userId: entry.user_id,
    nickname: entry.profiles?.nickname || 'Unknown',
    level: entry.profiles?.level || 1,
    avatar: entry.profiles?.avatar_url || '',
    totalArea: Number(entry.area_controlled || 0),
    tilesCaptured: entry.tiles_captured || 0,
    reputation: entry.reputation || 0
  }));
}

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
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Number(limitParam) : 50;

    if (!cityId) {
      return NextResponse.json({ error: 'cityId required' }, { status: 400 });
    }

    const safeLimit = Math.min(Math.max(1, limit), 100);
    const isGlobal = cityId === 'global';
    const scope = isGlobal ? 'nation' : 'city';
    const effectiveCityId = isGlobal ? 'global' : cityId;
    const today = new Date().toISOString().split('T')[0];

    const snapshotKey = isGlobal 
      ? `lead:snapshot:${today}:global:nation`
      : `lead:snapshot:${today}:${cityId}:city`;
    
    const latestKey = isGlobal
      ? `lead:snapshot:latest:global:nation`
      : `lead:snapshot:latest:${cityId}:city`;

    const lockKey = `lock:leaderboard:${today}:${effectiveCityId}:${scope}`;

    try {
      // 1. 优先尝试从今日快照读取
      const cached = await redis.get(snapshotKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        return NextResponse.json({ success: true, data: parsed.slice(0, safeLimit) });
      }

      // 2. 今日无快照，尝试抢占生成锁
      const lock = await redis.set(lockKey, 'processing', 'EX', 300, 'NX');
      
      if (lock) {
        // 抢锁成功，后台启动生成任务 (非阻塞)
        (async () => {
          try {
            console.log(`[Leaderboard] Starting generation for ${scope} - ${effectiveCityId}`);
            const freshData = await generateLeaderboardData(cityId, 100);
            const serialized = JSON.stringify(freshData);
            
            await Promise.all([
              redis.set(snapshotKey, serialized, 'EX', 172800),
              redis.set(latestKey, serialized)
            ]);
            console.log(`[Leaderboard] Successfully generated snapshot: ${snapshotKey}`);
          } catch (genErr) {
            console.error(`[Leaderboard] Generation failed for ${snapshotKey}:`, genErr);
            await redis.del(lockKey);
          }
        })();
      }

      // 3. 无论是否抢锁成功，均返回 Latest 缓存作为兜底
      const latest = await redis.get(latestKey);
      if (latest) {
        const parsed = JSON.parse(latest);
        return NextResponse.json({ success: true, data: parsed.slice(0, safeLimit) });
      }
    } catch (err) {
      console.error(`[Leaderboard] logic error for ${cityId}:`, err);
    }

    // 4. 若无缓存且无 Latest，返回空数组
    return NextResponse.json({ success: true, data: [] });
  } catch (error: any) {
    console.error('[GET /api/v1/city/leaderboard] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
