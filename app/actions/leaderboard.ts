"use server"

import { createClient } from "@/lib/supabase/client"
import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"

export type LeaderboardType = 'PERSONAL' | 'PERSONAL_PROVINCE' | 'CLUB_NATIONAL' | 'CLUB_PROVINCE' | 'PROVINCE' | 'PROVINCE_CITY';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatar_url?: string;
  score: number; // Territory Area
  secondary_info?: string; // e.g., Province name, Club name
  is_me?: boolean;
  change?: 'up' | 'down' | 'same';
}

export async function getLeaderboardData(type: LeaderboardType, userId?: string, page: number = 1, limit: number = 50): Promise<LeaderboardEntry[]> {
  // Use unstable_cache to cache results for performance (e.g. 1 hour for heavy queries)
  // For 'PERSONAL' maybe less cache or no cache if we want real-time.
  // For now, we fetch directly for simplicity, but in production consider caching.

  try {
    let data: LeaderboardEntry[] = [];

    switch (type) {
      case 'PERSONAL':
        data = await getPersonalLeaderboard(userId, undefined, page, limit);
        break;
      case 'PERSONAL_PROVINCE':
        if (!userId) return []; // Need user to determine province
        const userForProvince = await prisma.profiles.findUnique({
          where: { id: userId },
          select: { province: true }
        });
        if (!userForProvince?.province) return []; // User has no province set
        data = await getPersonalLeaderboard(userId, userForProvince.province, page, limit);
        break;
      case 'CLUB_NATIONAL':
        data = await getClubLeaderboard(null, userId, null, page, limit);
        break;
      case 'CLUB_PROVINCE':
        if (!userId) return []; // Need user to determine province
        // First get user's province
        const user = await prisma.profiles.findUnique({ where: { id: userId }, select: { province: true, club_id: true } });
        if (!user?.province) return []; // User has no province set
        data = await getClubLeaderboard(user.province, userId, user.club_id, page, limit);
        break;
      case 'PROVINCE':
        data = await getProvinceLeaderboard(page, limit);
        break;
      case 'PROVINCE_CITY':
        if (!userId) return [];
        const userForCity = await prisma.profiles.findUnique({
          where: { id: userId },
          select: { province: true }
        });
        if (!userForCity?.province) return [];
        data = await getProvinceCityLeaderboard(userForCity.province, page, limit);
        break;
    }

    return data;
  } catch (error) {
    console.error(`Failed to fetch leaderboard ${type}:`, error);
    return [];
  }
}

async function getPersonalLeaderboard(currentUserId?: string, province?: string, page: number = 1, limit: number = 50): Promise<LeaderboardEntry[]> {
  // Fetch top users by total_area
  const where = province ? { province } : {};
  const skip = (page - 1) * limit;

  const users = await prisma.profiles.findMany({
    where,
    orderBy: { total_area: 'desc' },
    skip,
    take: limit,
    select: {
      id: true,
      nickname: true,
      avatar_url: true,
      total_area: true,
      province: true,
      club_id: true
    }
  });

  return users.map((user, index) => ({
    rank: skip + index + 1,
    id: user.id,
    name: user.nickname || 'Unknown Runner',
    avatar_url: user.avatar_url || undefined,
    score: Math.round(user.total_area || 0),
    secondary_info: user.province || undefined,
    is_me: currentUserId === user.id,
    change: 'same' // Placeholder for now
  }));
}

async function getClubLeaderboard(province: string | null, currentUserId?: string, userClubId?: string | null, page: number = 1, limit: number = 50): Promise<LeaderboardEntry[]> {
  const where = province ? { province } : {};
  const skip = (page - 1) * limit;

  const clubs = await prisma.clubs.findMany({
    where,
    orderBy: { total_area: 'desc' },
    skip,
    take: limit,
    select: {
      id: true,
      name: true,
      avatar_url: true,
      total_area: true,
      province: true
    }
  });

  // If userClubId is not passed, try to fetch it
  let myClubId = userClubId;
  if (currentUserId && !myClubId) {
    const user = await prisma.profiles.findUnique({ where: { id: currentUserId }, select: { club_id: true } });
    myClubId = user?.club_id;
  }

  return clubs.map((club, index) => ({
    rank: skip + index + 1,
    id: club.id,
    name: club.name,
    avatar_url: club.avatar_url || undefined,
    score: Math.round(Number(club.total_area || 0)),
    secondary_info: club.province || 'National',
    is_me: myClubId === club.id,
    change: 'same'
  }));
}

async function getProvinceLeaderboard(page: number = 1, limit: number = 50): Promise<LeaderboardEntry[]> {
  const skip = (page - 1) * limit;
  // Query ProvinceStat table
  const stats = await prisma.provinceStat.findMany({
    where: { NOT: { provinceName: { contains: '_CITY_' } } },
    orderBy: { totalTerritoryArea: 'desc' },
    skip,
    take: limit
  });

  return stats.map((stat, index) => ({
    rank: skip + index + 1,
    id: String(stat.id),
    name: stat.provinceName,
    score: Math.round(stat.totalTerritoryArea),
    change: 'same'
  }));
}

async function getProvinceCityLeaderboard(province: string, page: number = 1, limit: number = 50): Promise<LeaderboardEntry[]> {
  const skip = (page - 1) * limit;
  const stats = await prisma.provinceStat.findMany({
    where: { provinceName: { startsWith: province + '_CITY_' } },
    orderBy: { totalTerritoryArea: 'desc' },
    skip,
    take: limit
  });

  return stats.map((stat, index) => ({
    rank: skip + index + 1,
    id: String(stat.id),
    name: stat.provinceName.replace(province + '_CITY_', ''),
    score: Math.round(stat.totalTerritoryArea),
    change: 'same',
    secondary_info: province
  }));
}

// Scheduled Task Logic (can be called via API route /api/cron/update-province-stats)
export async function updateProvinceStats() {
  try {
    // 1. Aggregate territory areas by province from Clubs (assuming clubs cover most territories)
    // Or better: Aggregate from Users -> Province if users have province.
    // Let's assume User.province is the source of truth for "Province Power".
    // Alternatively, aggregate from Territories if Territories had a province field (which they don't seem to have directly, they link to City).
    // Simplest approach for now: Sum total_area of all Users grouped by Province.

    const aggregated = await prisma.profiles.groupBy({
      by: ['province'],
      _sum: {
        total_area: true
      },
      where: {
        province: { not: null }
      }
    });

    // 2. Update ProvinceStat table for provinces
    let updatedCount = 0;
    for (const group of aggregated) {
      if (!group.province) continue;

      const totalArea = group._sum.total_area || 0;

      await prisma.provinceStat.upsert({
        where: { provinceName: group.province },
        update: {
          totalTerritoryArea: totalArea,
          updatedAt: new Date()
        },
        create: {
          provinceName: group.province,
          totalTerritoryArea: totalArea
        }
      });
      updatedCount++;
    }

    // 3. Aggregate City sizes by joining user_city_progress and profiles
    // Raw query to group by profile.province and user_city_progress.city_id
    const cityAggregated = await prisma.$queryRaw<any[]>`
      SELECT p.province, ucp.city_id, SUM(ucp.area_controlled) as total_area
      FROM user_city_progress ucp
      JOIN profiles p ON ucp.user_id = p.id
      WHERE p.province IS NOT NULL AND ucp.city_id IS NOT NULL AND ucp.city_id != ''
      GROUP BY p.province, ucp.city_id
    `;

    for (const row of cityAggregated) {
      if (!row.province || !row.city_id) continue;

      const cityKey = `${row.province}_CITY_${row.city_id}`;
      const cityArea = Number(row.total_area) || 0;

      await prisma.provinceStat.upsert({
        where: { provinceName: cityKey },
        update: {
          totalTerritoryArea: cityArea,
          updatedAt: new Date()
        },
        create: {
          provinceName: cityKey,
          totalTerritoryArea: cityArea
        }
      });
      updatedCount++;
    }

    return { success: true, count: updatedCount };
  } catch (error) {
    console.error("Failed to update province stats:", error);
    return { success: false, error };
  }
}

// ──────────────────────────────────────────────
// Activity Leaderboard — by score within a specific club activity
// ──────────────────────────────────────────────
export async function getActivityLeaderboard(
  activityId: string,
  page: number = 1,
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  try {
    const skip = (page - 1) * limit;

    const registrations = await prisma.club_activity_registrations.findMany({
      where: {
        activity_id: activityId,
        status: { in: ['registered', 'completed'] },
      },
      orderBy: { score: 'desc' },
      skip,
      take: limit,
      include: {
        profiles: {
          select: {
            id: true,
            nickname: true,
            avatar_url: true,
          },
        },
      },
    });

    return registrations.map((reg, index) => ({
      rank: skip + index + 1,
      id: reg.user_id,
      name: reg.profiles?.nickname || 'Unknown',
      avatar_url: reg.profiles?.avatar_url || undefined,
      score: reg.score,
      secondary_info: reg.status === 'completed' ? '已完成' : '已报名',
      change: 'same' as const,
    }));
  } catch (error) {
    console.error('Failed to fetch activity leaderboard:', error);
    return [];
  }
}

// ──────────────────────────────────────────────
// Social Leaderboard — contribution-weighted ranking
// Weight: activity_created×3 + social_interactions×1 + achievements×2
// ──────────────────────────────────────────────
export async function getSocialLeaderboard(
  currentUserId?: string,
  page: number = 1,
  limit: number = 50
): Promise<LeaderboardEntry[]> {
  try {
    const skip = (page - 1) * limit;

    // Raw query for contribution-weighted social ranking
    const results = await prisma.$queryRaw<
      {
        id: string;
        nickname: string | null;
        avatar_url: string | null;
        activity_score: bigint;
        social_score: bigint;
        achievement_score: bigint;
        total_score: bigint;
      }[]
    >`
      SELECT
        p.id,
        p.nickname,
        p.avatar_url,
        COALESCE(act.cnt, 0) * 3 AS activity_score,
        COALESCE(social.cnt, 0) * 1 AS social_score,
        COALESCE(ach.cnt, 0) * 2 AS achievement_score,
        (COALESCE(act.cnt, 0) * 3 + COALESCE(social.cnt, 0) * 1 + COALESCE(ach.cnt, 0) * 2) AS total_score
      FROM profiles p
      LEFT JOIN (
        SELECT created_by AS user_id, COUNT(*)::int AS cnt
        FROM club_activities
        GROUP BY created_by
      ) act ON act.user_id = p.id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS cnt
        FROM activity_likes
        GROUP BY user_id
      ) social ON social.user_id = p.id
      LEFT JOIN (
        SELECT user_id, COUNT(*)::int AS cnt
        FROM user_badges
        GROUP BY user_id
      ) ach ON ach.user_id = p.id
      ORDER BY total_score DESC
      LIMIT ${limit}
      OFFSET ${skip}
    `;

    return results.map((row, index) => ({
      rank: skip + index + 1,
      id: row.id,
      name: row.nickname || 'Unknown',
      avatar_url: row.avatar_url || undefined,
      score: Number(row.total_score),
      secondary_info: `活动:${Number(row.activity_score)} 社交:${Number(row.social_score)} 成就:${Number(row.achievement_score)}`,
      is_me: currentUserId === row.id,
      change: 'same' as const,
    }));
  } catch (error) {
    console.error('Failed to fetch social leaderboard:', error);
    return [];
  }
}
