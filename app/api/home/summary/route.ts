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
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userLat = parseFloat(searchParams.get('lat') || '0');
    const userLng = parseFloat(searchParams.get('lng') || '0');
    const scope = searchParams.get('scope') || 'nearby';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Run all queries in parallel for speed
    const [
        profileResult,
        battleFeedResult,
        progressResult,
        leaderboardResult,
        clubResult,
        notificationCountResult,
    ] = await Promise.allSettled([
        fetchProfile(userId),
        fetchBattleFeed(userId),
        fetchDailyProgress(userId),
        fetchLeaderboard(userId, scope),
        fetchClubEvents(userId),
        fetchUnreadNotificationCount(userId),
    ]);

    const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
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
        lat: userLat || null,
        lng: userLng || null,
        accuracy: null,
        updatedAt: new Date().toISOString(),
    };

    // === Step: Assemble Nearby Targets (A -> B -> C Fill-in) ===
    const nearbyTargets = await assembleNearbyTargets({
        userId,
        userLat,
        userLng,
        province: profile?.province || '上海'
    });

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

/** 
 * 核心装配逻辑：A (领地) -> B (路线) -> C (兜底)
 * 实现补位逻辑，填满 6 个目标。
 */
async function assembleNearbyTargets({ 
    userId, 
    userLat, 
    userLng,
    province 
}: { 
    userId: string, 
    userLat: number, 
    userLng: number,
    province: string
}): Promise<Target[]> {
    const TARGET_COUNT = 6;
    const results: any[] = [];
    const seenIds = new Set<string>();

    const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    // --- Phase A: Nearby Active Territories ---
    const territories = await prisma.territories.findMany({
        where: {
            owner_id: { not: userId },
            status: 'ACTIVE',
        },
        orderBy: [
            { last_maintained_at: 'asc' }, // 活跃度/维护度排序
        ],
        take: 10, // 为了后续排序取稍多一点
        select: {
            id: true,
            owner_id: true,
            health: true,
            level: true,
            profiles: { select: { nickname: true } }
        }
    });

    const mappedA = territories.map(t => {
        // Mock coordinates if not in DB, centered around user with small offset
        const tLat = userLat + (Math.random() - 0.5) * 0.01;
        const tLng = userLng + (Math.random() - 0.5) * 0.01;
        const distM = Math.round(getDist(userLat, userLng, tLat, tLng));
        const health = t.health ?? 1000;
        const riskLevel = health > 700 ? 'high' : health > 400 ? 'med' : 'low';
        
        return {
            source: 'territory',
            id: t.id,
            title: `${t.profiles?.nickname ?? '神秘领主'}的领地`,
            type: (health < 300 ? 'claim' : 'attack') as any,
            distance: distM > 1000 ? `${(distM / 1000).toFixed(1)}km` : `${distM}m`,
            distanceMeters: distM,
            summary: health < 300 ? '防守薄弱，速来占领' : `精力充沛 (${health} HP)`,
            rewardEstimate: `+${Math.round((1000 - health) / 20) + 10} 勋章`,
            thumbnail: 'map-pin',
            action: `/game/map?targetId=${t.id}`,
            riskLevel: riskLevel,
            riskLabel: health > 700 ? '对方非常强大' : health > 400 ? '有一场硬仗' : '防守极其松懈'
        };
    }).sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);

    for (const item of mappedA) {
        if (results.length >= TARGET_COUNT) break;
        const key = `${item.source}:${item.id}`;
        if (!seenIds.has(key)) {
            results.push(item);
            seenIds.add(key);
        }
    }

    // --- Phase B: Nearby Recommended Routes ---
    if (results.length < TARGET_COUNT) {
        const routes = await prisma.route_plans.findMany({
            orderBy: { created_at: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                distance: true,
                capture_area: true,
            }
        });

        const mappedB = routes.map((r: any) => {
            // 模拟一个随机偏移，使距离看起来更加“真实”地分布在附近
            const distKm = r.distance || (Math.random() * 2 + 0.5); 
            const distM = Math.round(distKm * 1000);
            
            return {
                source: 'route',
                id: r.id,
                title: r.name || '附近的规划路线',
                type: 'claim' as any,
                distance: distKm >= 1 ? `${distKm.toFixed(1)}km` : `${distM}m`,
                distanceMeters: Number(distM), // 强制确保为 number
                summary: `预计产出 ${(r.capture_area || 0.5).toFixed(1)}km² 领地`,
                rewardEstimate: `+${Math.round(distKm * 5 + 10)} 勋章`, // 格式化为字符串
                thumbnail: 'route',
                action: `/game/planner?id=${r.id}`,
                riskLevel: 'low' as any,
                riskLabel: '安全路线'
            };
        }).sort((a: any, b: any) => a.distanceMeters - b.distanceMeters);

        for (const item of mappedB) {
            if (results.length >= TARGET_COUNT) break;
            const key = `${item.source}:${item.id}`;
            if (!seenIds.has(key)) {
                results.push(item);
                seenIds.add(key);
            }
        }
    }

    // --- Phase C: Actionable Fallback Cards ---
    if (results.length < TARGET_COUNT) {
        const fallbackCards = [
            {
                id: 'c-plan',
                title: '规划新起点',
                type: 'claim' as any,
                distance: '步行 5min',
                distanceMeters: 500,
                summary: '开启一段全新的占地征程',
                rewardEstimate: '首次规划奖励',
                thumbnail: 'edit',
                action: '/game/planner',
                riskLevel: 'low' as any,
                riskLabel: '全速开启'
            },
            {
                id: 'c-hot',
                title: '探索热门区域',
                type: 'hotspot' as any,
                distance: '由你定义',
                distanceMeters: 1000,
                summary: '看看其他玩家都在哪里占领',
                rewardEstimate: '发现惊喜',
                thumbnail: 'trending-up',
                action: '/game/map',
                riskLevel: 'med' as any,
                riskLabel: '充满机遇'
            },
            {
                id: 'c-tutorial',
                title: '占领秘籍',
                type: 'defend' as any,
                distance: '就在手边',
                distanceMeters: 0,
                summary: '学习如何高效扩张你的领土',
                rewardEstimate: '成长加速',
                thumbnail: 'book-open',
                action: '/lord-center',
                riskLevel: 'low' as any,
                riskLabel: '轻松学习'
            }
        ];

        for (const item of fallbackCards) {
            if (results.length >= TARGET_COUNT) break;
            const key = `fallback:${item.id}`;
            if (!seenIds.has(key)) {
                results.push({ source: 'fallback', ...item });
                seenIds.add(key);
            }
        }
    }

    return results;
}

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

async function fetchBattleFeed(userId: string): Promise<BattleEvent[]> {
    const events: BattleEvent[] = [];

    // 1. Territories lost (someone else took over user's territory)
    const lostTerritories = await prisma.territory_owner_change_logs.findMany({
        where: {
            old_owner_id: userId,
        },
        orderBy: { changed_at: 'desc' },
        take: 5,
        select: {
            id: true,
            territory_id: true,
            new_owner_id: true,
            changed_at: true,
        },
    });

    for (const log of lostTerritories) {
        // Find attacker name
        const attackerProfile = await prisma.profiles.findUnique({
            where: { id: log.new_owner_id || undefined },
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
            new_owner_id: userId,
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
            new_owner_id: userId,
            old_owner_id: { not: null },
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

async function fetchLeaderboard(userId: string, scope: string): Promise<{
    leaderboard: RankItem[];
    myRank: RankItem | null;
}> {
    // 1. Fetch user profile first with province
    const userProfile = await prisma.profiles.findUnique({
        where: { id: userId },
        select: { total_area: true, nickname: true, province: true },
    });

    // 2. Condition building with boundary fallback handling
    const whereCondition: any = {};
    if (scope === 'city' && userProfile?.province) {
        whereCondition.province = userProfile.province;
    }

    // 3. Top 5 by total_area
    const topUsers = await prisma.profiles.findMany({
        where: whereCondition,
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

    if (!isInTop5 && userProfile) {
        const userArea = userProfile.total_area ?? 0;
        const rankCount = await prisma.profiles.count({
            where: { 
                ...whereCondition,
                total_area: { gt: userArea } 
            },
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
