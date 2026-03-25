'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { UserCityProgress, Territory, ExtTerritory } from '@/types/city'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Redefine types to avoid dependency on mock-api
export interface CityLeaderboardEntry {
  rank: number
  userId: string
  nickname: string
  level: number
  avatar: string
  totalArea: number
  tilesCaptured: number
  reputation: number
}

export async function fetchTerritories(cityId: string): Promise<ExtTerritory[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const currentUserId = user?.id

  try {
    const { data: terrData, error } = await supabaseAdmin
      .from('territories')
      .select(`
        id, city_id, owner_id, owner_club_id, owner_faction, 
        captured_at, health, last_maintained_at, owner_change_count, last_owner_change_at,
        geojson_json,
        clubs ( id, name, logo_url )
      `)
      .eq('city_id', cityId)

    if (error) {
      console.error('Error fetching territories:', error)
      return []
    }

    if (!terrData || terrData.length === 0) {
      return []
    }

    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - 7)

    return terrData.map((t: any) => {
      const changeCount = t.owner_change_count ?? 0
      const lastChange = t.last_owner_change_at ? new Date(t.last_owner_change_at) : null
      const isHotZone = changeCount >= 2 && lastChange != null && lastChange >= windowStart

      return {
        id: t.id,
        cityId: t.city_id,
        ownerId: t.owner_id ?? null,
        ownerType: !t.owner_id ? 'neutral' : (t.owner_id === currentUserId ? 'me' : 'enemy'),
        ownerClubId: t.owner_club_id ?? null,
        ownerFaction: t.owner_faction ?? null,
        capturedAt: t.captured_at,
        health: t.health ?? 1000,
        maxHealth: 1000,
        lastMaintainedAt: t.last_maintained_at,
        isHotZone,
        ownerChangeCount: changeCount,
        geojson_json: t.geojson_json,
        ownerClub: t.clubs ? {
          id: Array.isArray(t.clubs) ? t.clubs[0]?.id : t.clubs.id,
          name: Array.isArray(t.clubs) ? t.clubs[0]?.name : t.clubs.name,
          logoUrl: Array.isArray(t.clubs) ? t.clubs[0]?.logo_url : t.clubs.logo_url
        } : null
      }
    })
  } catch (err) {
    console.error('Territory fetch failed:', err)
    return []
  }
}

import { checkHiddenBadges } from './badge'
import { prisma } from '@/lib/prisma'
import { calculateFactionBalance } from '@/utils/faction-balance'
import { checkAndAwardBadges } from '@/app/actions/check-achievements'
import {
  H3_TILE_AREA_KM2,
  BASE_SCORE_PER_KM2,
  HOT_ZONE_CAPTURE_MULTIPLIER,
  NORMAL_CAPTURE_MULTIPLIER,
  LOSS_PENALTY_RATIO,
  HOT_ZONE_THRESHOLD,
  HOT_ZONE_WINDOW_DAYS,
} from '@/lib/constants/territory'
import { HotZoneCacheService } from '@/lib/services/hotzone-cache-service'
import { redis } from '@/lib/redis'
import { evaluatePenalty, getPenaltyConfig } from '@/lib/services/territory-penalty'

export async function claimTerritory(cityId: string, cellId: string, requestId?: string): Promise<{ success: boolean; error?: string; grantedBadges?: string[]; scoreChange?: number; isHotZone?: boolean }> {
  console.warn('Deprecated: claimTerritory (H3-based) called. Use polygon settlement instead.');
  return { 
    success: false, 
    error: 'This API is deprecated and has been disabled as part of the H3 legacy eradication.' 
  };
}

// ⚡️ 核心优化：外置 unstable_cache，分离纯净的聚合查询，杜绝隐式使用 cookies()
import { unstable_cache } from 'next/cache'

const getCachedCityStats = unstable_cache(
  async (cityId: string) => {
    // 1. Count total players in this city
    const totalPlayers = await prisma.user_city_progress.count({
      where: { city_id: cityId }
    })

    // 2. Count active players
    const lastWeek = new Date()
    lastWeek.setDate(lastWeek.getDate() - 7)
    const activePlayers = await prisma.user_city_progress.count({
      where: {
        city_id: cityId,
        last_active_at: { gt: lastWeek }
      }
    })

    // 3. Count total tiles captured
    const totalTiles = await prisma.territories.count({
      where: { city_id: cityId }
    })

    const ESTIMATED_AREA_PER_TILE = 0.01
    const totalArea = totalTiles * ESTIMATED_AREA_PER_TILE

    return {
      totalPlayers,
      activePlayers,
      totalArea: parseFloat(totalArea.toFixed(2)),
      totalTiles
    }
  },
  ['city-stats-agg'], // 缓存前缀
  { revalidate: 60, tags: ['city-stats'] }
)

export async function fetchCityStats(cityId: string) {
  if (!cityId) {
    return { totalPlayers: 0, activePlayers: 0, totalArea: 0, totalTiles: 0 }
  }
  // 隔离：直接传入参数，不再在缓存流中读取 headers/cookies
  return await getCachedCityStats(cityId)
}

// --- 排行榜每日快照逻辑 ---

/**
 * 内部函数：从数据库生成排行榜原始数据
 */
async function generateLeaderboardData(cityId: string, limit: number): Promise<CityLeaderboardEntry[]> {
  const isGlobal = cityId === 'global';
  
  if (isGlobal) {
    // 全国榜：从 profiles 表按 total_area 总计排序
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
      tilesCaptured: 0, // 全国维度暂不聚合具体地块数
      reputation: 0     // 全国维度暂不聚合具体声望
    }));
  }

  // 城市榜：从 user_city_progress 按该城市控制面积排序
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

/**
 * 获取排行榜数据 (含每日快照、幂等锁任务触发及最近快照兜底逻辑)
 */
export async function fetchCityLeaderboard(cityId: string, limit = 50): Promise<CityLeaderboardEntry[]> {
  if (!cityId) return [];
  
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const isGlobal = cityId === 'global';
  const scope = isGlobal ? 'nation' : 'city';
  const effectiveCityId = isGlobal ? 'global' : cityId;
  const today = new Date().toISOString().split('T')[0];

  // 定义 Key 规则
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
      return parsed.slice(0, safeLimit);
    }

    // 2. 今日无快照，尝试抢占生成锁
    // 使用 SET NX EX 实现分布式幂等，过期时间 300s
    const lock = await redis.set(lockKey, 'processing', 'EX', 300, 'NX');
    
    if (lock) {
      // 抢锁成功，后台启动生成任务 (非阻塞)
      // 生成 100 条作为标准快照存储
      (async () => {
        try {
          console.log(`[Leaderboard] Starting generation for ${scope} - ${effectiveCityId}`);
          const freshData = await generateLeaderboardData(cityId, 100);
          const serialized = JSON.stringify(freshData);
          
          await Promise.all([
            redis.set(snapshotKey, serialized, 'EX', 172800), // 存 48 小时
            redis.set(latestKey, serialized) // 永久更新为 Latest
          ]);
          console.log(`[Leaderboard] Successfully generated snapshot: ${snapshotKey}`);
        } catch (genErr) {
          console.error(`[Leaderboard] Generation failed for ${snapshotKey}:`, genErr);
          // 异常时清除锁，允许下一个请求重试
          await redis.del(lockKey);
        }
      })();
    }

    // 3. 无论是否抢锁成功，均返回 Latest 缓存作为兜底
    const latest = await redis.get(latestKey);
    if (latest) {
      const parsed = JSON.parse(latest);
      return parsed.slice(0, safeLimit);
    }
  } catch (err) {
    console.error(`[Leaderboard] logic error for ${cityId}:`, err);
  }

  // 4. 若无缓存且无 Latest，返回空数组
  return [];
}

export async function getUserCityProgress(cityId: string): Promise<UserCityProgress | null> {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('user_city_progress')
    .select('*')
    .eq('user_id', user.id)
    .eq('city_id', cityId)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
    console.error('Error fetching user progress:', error)
  }

  if (!data) {
    // Return default/empty progress if not found (or null to trigger creation)
    return null
  }

  // 2. Get user's rank
  // Rank = count of users with more area_controlled + 1
  const { count: rankCount, error: rankError } = await supabase
    .from('user_city_progress')
    .select('*', { count: 'exact', head: true })
    .eq('city_id', cityId)
    .gt('area_controlled', (data as any).area_controlled || 0)

  const ranking = (rankCount !== null) ? rankCount + 1 : 0

  return {
    userId: (data as any).user_id,
    cityId: (data as any).city_id,
    level: (data as any).level,
    experience: (data as any).experience,
    experienceProgress: { current: 0, max: 100 }, // Calc based on logic if needed
    tilesCaptured: (data as any).tiles_captured,
    areaControlled: (data as any).area_controlled,
    ranking: ranking,
    reputation: (data as any).reputation,
    completedChallenges: [], // Need relation
    unlockedAchievements: [], // Need relation
    lastActiveAt: (data as any).last_active_at,
    joinedAt: (data as any).joined_at
  }
}

export async function initUserCityProgress(cityId: string) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data, error } = await supabase
    .from('user_city_progress')
    .insert({
      user_id: user.id,
      city_id: cityId,
      joined_at: new Date().toISOString(),
      last_active_at: new Date().toISOString()
    } as any)
    .select()
    .single()

  if (error) throw error
  return data
}
