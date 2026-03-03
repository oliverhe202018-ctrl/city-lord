import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type {
    HomeSummaryData,
    Target,
    BattleEvent,
    ProgressItem,
    RankItem,
    ClubEvent,
    HomeHero,
    HomeLocation,
} from '@/types/home';

/**
 * GET /api/home/summary
 * Aggregated homepage data — real DB queries.
 * Each section has a safe fallback so partial failures don't crash the whole page.
 */
export async function GET() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Run all queries in parallel for speed
    const [
        profileResult,
        territoriesResult,
        battleFeedResult,
        progressResult,
        leaderboardResult,
        clubResult,
        notificationCountResult,
    ] = await Promise.allSettled([
        fetchProfile(userId),
        fetchNearbyTargets(userId),
        fetchBattleFeed(userId),
        fetchDailyProgress(userId),
        fetchLeaderboard(userId),
        fetchClubEvents(userId),
        fetchUnreadNotificationCount(userId),
    ]);

    const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
    const nearbyTargets = territoriesResult.status === 'fulfilled' ? territoriesResult.value : [];
    const battleFeed = battleFeedResult.status === 'fulfilled' ? battleFeedResult.value : [];
    const progressItems = progressResult.status === 'fulfilled' ? progressResult.value : [];
    const { leaderboard, myRank } = leaderboardResult.status === 'fulfilled'
        ? leaderboardResult.value
        : { leaderboard: [], myRank: null };
    const clubMini = clubResult.status === 'fulfilled' ? clubResult.value : [];
    const notifCount = notificationCountResult.status === 'fulfilled'
        ? notificationCountResult.value
        : 0;

    // === Build hero section ===
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const hero: HomeHero = {
        modeDefault: 'claim',
        todayRewardLeft: Math.max(0, 100 - (profile?.coins_earned_today ?? 0)),
        todayRewardTotal: 100,
        cooldownHint: null,
        estimatedCoverage: Math.max(3, 12 - (profile?.territory_count_today ?? 0)),
    };

    // === Build location ===
    const location: HomeLocation = {
        cityId: profile?.province ?? 'unknown',
        cityName: profile?.province ?? '未知城市',
        countyName: undefined,
        lat: null,
        lng: null,
        accuracy: null,
        updatedAt: new Date().toISOString(),
    };

    const data: HomeSummaryData & { notificationCount: number } = {
        location,
        hero,
        nearbyTargets,
        battleFeed,
        dailyProgress: progressItems,
        leaderboardMini: leaderboard,
        myRank,
        clubMini,
        notificationCount: notifCount,
    };

    return NextResponse.json(data);
}

// ======================== Query Functions ========================

async function fetchProfile(userId: string) {
    const profile = await prisma.profiles.findUnique({
        where: { id: userId },
        select: {
            nickname: true,
            coins: true,
            total_area: true,
            total_distance_km: true,
            province: true,
            club_id: true,
            level: true,
        },
    });

    if (!profile) return null;

    // Count today's territory claims
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const territoryCountToday = await prisma.territories.count({
        where: {
            owner_id: userId,
            captured_at: { gte: todayStart },
        },
    });

    // Estimate coins earned today from task logs
    const todayLogs = await prisma.user_task_logs.aggregate({
        where: {
            user_id: userId,
            completed_at: { gte: todayStart },
        },
        _sum: { reward_coins: true },
    });

    return {
        ...profile,
        territory_count_today: territoryCountToday,
        coins_earned_today: todayLogs._sum.reward_coins ?? 0,
    };
}

async function fetchNearbyTargets(userId: string): Promise<Target[]> {
    // Fetch territories NOT owned by the user (claimable/attackable targets)
    // For v1: show recently changed or active territories near the user's activity area
    const recentTargets = await prisma.territories.findMany({
        where: {
            owner_id: { not: userId },
            status: 'active',
        },
        orderBy: { last_maintained_at: 'asc' }, // Weakest / least maintained first
        take: 6,
        select: {
            id: true,
            city_id: true,
            owner_id: true,
            health: true,
            level: true,
            h3_index: true,
            captured_at: true,
            profiles: {
                select: { nickname: true },
            },
        },
    });

    return recentTargets.map((t, i) => {
        const health = t.health ?? 1000;
        const riskLevel = health > 700 ? 'high' : health > 400 ? 'med' : 'low';
        const type = health < 300 ? 'claim' : 'attack';
        const estimatedReward = Math.round((1000 - health) / 50) + 5;

        return {
            id: t.id,
            type: type as any,
            title: `${t.profiles?.nickname ?? '玩家'}的地块`,
            distanceMeters: 200 + i * 300, // Placeholder — real distance needs user coords
            rewardEstimate: `+${estimatedReward} 分`,
            riskLevel: riskLevel as any,
            riskLabel: riskLevel === 'high'
                ? '对方强度高'
                : riskLevel === 'med'
                    ? '对方强度中等'
                    : '防守薄弱',
            lat: 0,
            lng: 0,
        };
    });
}

async function fetchBattleFeed(userId: string): Promise<BattleEvent[]> {
    const events: BattleEvent[] = [];

    // 1. Territories lost (someone else took over user's territory)
    const lostTerritories = await prisma.territory_owner_change_logs.findMany({
        where: {
            previous_owner: userId,
        },
        orderBy: { changed_at: 'desc' },
        take: 5,
        select: {
            id: true,
            territory_id: true,
            new_owner: true,
            changed_at: true,
        },
    });

    for (const log of lostTerritories) {
        // Find attacker name
        const attackerProfile = await prisma.profiles.findUnique({
            where: { id: log.new_owner },
            select: { nickname: true },
        });

        const timeAgo = getTimeAgoText(log.changed_at);
        events.push({
            id: `lost-${log.id}`,
            type: 'lost',
            text: `${attackerProfile?.nickname ?? '未知玩家'} ${timeAgo}偷走了你的 ${log.territory_id.slice(0, 8)} 地块`,
            createdAt: log.changed_at?.toISOString() ?? new Date().toISOString(),
            relatedTargetId: log.territory_id,
            ctaType: 'counter',
            ctaLabel: '反击',
            severity: 'warn',
        });
    }

    // 2. Territories defended (HP attacks where user still owns)
    const ownedTerritoryIds = await prisma.territories.findMany({
        where: { owner_id: userId },
        select: { id: true },
        take: 100,
    });

    if (ownedTerritoryIds.length > 0) {
        const recentAttacks = await prisma.territory_hp_logs.findMany({
            where: {
                territory_id: { in: ownedTerritoryIds.map((t) => t.id) },
                attacker_id: { not: userId },
            },
            orderBy: { attacked_at: 'desc' },
            take: 3,
            select: {
                id: true,
                territory_id: true,
                damage: true,
                attacked_at: true,
            },
        });

        for (const atk of recentAttacks) {
            events.push({
                id: `defend-${atk.id}`,
                type: 'defend',
                text: `你守住了 ${atk.territory_id.slice(0, 8)}（受到 ${atk.damage} 伤害）`,
                createdAt: atk.attacked_at?.toISOString() ?? new Date().toISOString(),
                relatedTargetId: atk.territory_id,
                ctaType: 'see',
                ctaLabel: '查看',
                severity: 'info',
            });
        }
    }

    // 3. Territories won (user captured something)
    const wonTerritories = await prisma.territory_owner_change_logs.findMany({
        where: {
            new_owner: userId,
        },
        orderBy: { changed_at: 'desc' },
        take: 3,
        select: {
            id: true,
            territory_id: true,
            changed_at: true,
        },
    });

    for (const log of wonTerritories) {
        events.push({
            id: `win-${log.id}`,
            type: 'win',
            text: `你占领了 ${log.territory_id.slice(0, 8)}`,
            createdAt: log.changed_at?.toISOString() ?? new Date().toISOString(),
            ctaType: 'share',
            ctaLabel: '炫耀',
            severity: 'info',
        });
    }

    // Sort: warn first, then by time
    events.sort((a, b) => {
        if (a.severity === 'warn' && b.severity !== 'warn') return -1;
        if (b.severity === 'warn' && a.severity !== 'warn') return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return events.slice(0, 5);
}

async function fetchDailyProgress(userId: string): Promise<ProgressItem[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Count territories captured today
    const capturesToday = await prisma.territories.count({
        where: {
            owner_id: userId,
            captured_at: { gte: todayStart },
        },
    });

    // Count attacks today (territory owner changes where user is attacker)
    const attacksToday = await prisma.territory_owner_change_logs.count({
        where: {
            new_owner: userId,
            previous_owner: { not: null },
            changed_at: { gte: todayStart },
        },
    });

    // Count runs today (for social/share tracking, use runs as proxy)
    const runsToday = await prisma.runs.count({
        where: {
            user_id: userId,
            created_at: { gte: todayStart },
        },
    });

    return [
        {
            key: 'expand',
            label: '扩张',
            current: Math.min(capturesToday, 20),
            total: 20,
            remaining: Math.max(0, 20 - capturesToday),
            icon: 'Hexagon',
            ctaLabel: capturesToday >= 20 ? undefined : '去完成',
        },
        {
            key: 'combat',
            label: '对抗',
            current: Math.min(attacksToday, 3),
            total: 3,
            remaining: Math.max(0, 3 - attacksToday),
            icon: 'Swords',
            ctaLabel: attacksToday >= 3 ? undefined : '去完成',
        },
        {
            key: 'social',
            label: '社交',
            current: Math.min(runsToday, 1), // Using runs as proxy for social activity
            total: 1,
            remaining: Math.max(0, 1 - runsToday),
            icon: 'Share2',
            ctaLabel: runsToday >= 1 ? undefined : '+10 币',
        },
    ];
}

async function fetchLeaderboard(userId: string): Promise<{
    leaderboard: RankItem[];
    myRank: RankItem | null;
}> {
    // Top 5 by total_area
    const topUsers = await prisma.profiles.findMany({
        orderBy: { total_area: 'desc' },
        take: 5,
        select: {
            id: true,
            nickname: true,
            avatar_url: true,
            total_area: true,
        },
    });

    const leaderboard: RankItem[] = topUsers.map((u, i) => ({
        rank: i + 1,
        name: u.nickname || '未知跑者',
        score: Math.round(u.total_area ?? 0),
        avatar: u.avatar_url || undefined,
        isMe: u.id === userId,
    }));

    // Find user's rank if not in top 5
    const isInTop5 = topUsers.some((u) => u.id === userId);
    let myRank: RankItem | null = null;

    if (!isInTop5) {
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { total_area: true, nickname: true },
        });

        if (userProfile) {
            const userArea = userProfile.total_area ?? 0;
            const rankCount = await prisma.profiles.count({
                where: { total_area: { gt: userArea } },
            });

            const rank = rankCount + 1;
            const fifthPlace = topUsers[4];
            const gapToTop5 = fifthPlace
                ? Math.round((fifthPlace.total_area ?? 0) - userArea)
                : 0;

            myRank = {
                rank,
                name: userProfile.nickname || '我',
                score: Math.round(userArea),
                isMe: true,
                gapToTarget: Math.max(0, gapToTop5),
            };
        }
    }

    return { leaderboard, myRank };
}

async function fetchClubEvents(userId: string): Promise<ClubEvent[]> {
    // Find user's club
    const profile = await prisma.profiles.findUnique({
        where: { id: userId },
        select: { club_id: true },
    });

    if (!profile?.club_id) return [];

    // Recent club activities
    const activities = await prisma.club_activities.findMany({
        where: { club_id: profile.club_id },
        orderBy: { created_at: 'desc' },
        take: 5,
        select: {
            id: true,
            title: true,
            created_at: true,
            creator: {
                select: { nickname: true },
            },
        },
    });

    return activities.map((a) => ({
        id: a.id,
        memberName: a.creator.nickname || '队友',
        text: a.title,
        createdAt: a.created_at.toISOString(),
    }));
}

async function fetchUnreadNotificationCount(userId: string): Promise<number> {
    return prisma.notifications.count({
        where: {
            user_id: userId,
            is_read: false,
        },
    });
}

// ======================== Helpers ========================

function getTimeAgoText(date: Date | null | undefined): string {
    if (!date) return '';
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
}
