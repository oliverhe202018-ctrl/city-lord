'use client';

import { useState, useMemo, useCallback, useEffect, memo, lazy, Suspense } from 'react';
import Link from 'next/link';
import { MessageSquarePlus, Route, Calendar, TrendingUp, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useHomeData } from '@/hooks/useHomeData';
import { HomeTopBar } from './HomeTopBar';
import { HeroStartRunCard } from './HeroStartRunCard';
import { HomeSkeleton } from './HomeSkeleton';
import { NearbyTargetsCarousel } from './NearbyTargetsCarousel';
import { BattleFeedMini } from './BattleFeedMini';
import { DailyProgressBars } from './DailyProgressBars';
import type { RunMode, Target, BattleEvent } from '@/types/home';

// Only lazy-load heavy below-fold component (~14KB)
const LeaderboardMini = lazy(() =>
    import('./LeaderboardMini').then(m => ({ default: m.LeaderboardMini }))
);

/** Fixed-height fallback for lazy LeaderboardMini — avoids CLS */
function LeaderboardFallback() {
    return (
        <div className="px-4">
            <div className="h-8 w-40 rounded bg-white/10 mb-3 animate-pulse" />
            <div className="h-[180px] rounded-xl bg-white/3 animate-pulse" />
        </div>
    );
}

interface GameHomePageProps {
    /** Triggered when user clicks the main CTA "开始占地跑" */
    onStartRun: (mode: RunMode) => void;
    /** Navigate to the map tab, optionally highlighting a target */
    onNavigateToMap: (targetId?: string) => void;
    /** Navigate to a specific tab (missions, social, etc.) */
    onNavigateToTab: (tab: string) => void;
    /** Navigate to smart planning page */
    onSmartPlan?: () => void;
}

interface RouteData {
    id: string;
    name: string;
    distance: number;
    capture_area: number;
    created_at: string;
    waypoints?: [number, number][];
}

/** 
 * Lightweight SVG Route Thumbnail
 * Renders a scaled path based on coordinate bounds
 */
const RouteThumbnail = memo(({ waypoints }: { waypoints?: [number, number][] }) => {
    if (!waypoints || waypoints.length < 2) {
        return (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
                <Route className="h-6 w-6 text-primary/20" />
            </div>
        );
    }

    try {
        // Find bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        waypoints.forEach(([x, y]) => {
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        });

        const width = maxX - minX;
        const height = maxY - minY;

        // Prevent division by zero or rendering meaningless points (width/height <= 0)
        if (width <= 0 && height <= 0) {
            return (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
                    <MapPin className="h-5 w-5 text-primary/30" />
                </div>
            );
        }

        const padding = 12; // Adjusted SVG space padding
        const svgSize = 100;
        const innerSize = svgSize - padding * 2;

        // Scaling factors to fit in 100x100 ViewBox
        const maxDim = Math.max(width, height);
        const scale = maxDim > 0 ? innerSize / maxDim : 1;
        
        // Center the path
        const offsetX = padding + (innerSize - width * scale) / 2;
        const offsetY = padding + (innerSize - height * scale) / 2;

        const points = waypoints.map(([x, y]) => {
            const px = offsetX + (x - minX) * scale;
            // Invert Y for screen coordinates (coordinates increase downwards)
            const py = offsetY + (height - (y - minY)) * scale;
            // Use Number.isFinite for robust numerical check
            if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
            return `${px.toFixed(1)},${py.toFixed(1)}`;
        }).filter((p): p is string => p !== null);

        if (points.length < 2) throw new Error('Insufficient valid points after processing');

        const pathData = `M ${points.join(' L ')}`;

        return (
            <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="h-full w-full p-2" preserveAspectRatio="xMidYMid meet">
                <path
                    d={pathData}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary/60"
                />
            </svg>
        );
    } catch (e) {
        // Unify fallback UI with main placeholder
        return (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
                <Route className="h-6 w-6 text-primary/20" />
            </div>
        );
    }
});
RouteThumbnail.displayName = 'RouteThumbnail';

function GameHomePageInner({ onStartRun, onNavigateToMap, onNavigateToTab, onSmartPlan }: GameHomePageProps) {
    const { data, isLoading: isHomeLoading } = useHomeData();
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const [isRoutesLoading, setIsRoutesLoading] = useState(true);
    const [routesError, setRoutesError] = useState(false);

    const fetchRoutes = useCallback(async () => {
        setIsRoutesLoading(true);
        setRoutesError(false);
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_SERVER || ''}/api/routes`);
            if (!res.ok) throw new Error('Failed to fetch routes');
            const data = await res.json();
            // Sort by created_at desc and take top 2
            const sorted = (data as RouteData[]).sort((a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ).slice(0, 2);
            setRoutes(sorted);
        } catch (error) {
            console.error('Error fetching routes:', error);
            setRoutesError(true);
        } finally {
            setIsRoutesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoutes();
    }, [fetchRoutes]);

    const isLoading = isHomeLoading;

    // Check if there are warning events — affects section ordering
    const hasWarningEvents = useMemo(
        () => (data?.battleFeed ?? []).some((e) => e.severity === 'warn'),
        [data?.battleFeed]
    );

    const handleGoToTarget = useCallback(
        (target: Target) => {
            onNavigateToMap(target.id);
        },
        [onNavigateToMap]
    );

    const handleCounterAttack = useCallback(
        (event: BattleEvent) => {
            onNavigateToMap(event.relatedTargetId);
        },
        [onNavigateToMap]
    );

    const handleViewEvent = useCallback(
        (_event: BattleEvent) => {
            onNavigateToMap();
        },
        [onNavigateToMap]
    );

    const handleTargetUnavailable = useCallback(
        (_event: BattleEvent) => {
            // Could navigate to nearest available target
            onNavigateToMap();
        },
        [onNavigateToMap]
    );

    const handleGoToMissions = useCallback(() => {
        onNavigateToTab('missions');
    }, [onNavigateToTab]);

    // Full skeleton while first load
    if (isLoading && !data) {
        return (
            <HomeSkeleton
                onStartRun={() => onStartRun('claim')}
            />
        );
    }

    return (
        <div className="flex h-full flex-col bg-background">
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto themed-scrollbar pb-24">
                {/* 0) Top Bar */}
                <HomeTopBar
                    notificationCount={
                        (data as any)?.notificationCount ??
                        (data?.battleFeed ?? []).filter((e) => e.severity === 'warn').length
                    }
                    onNotificationClick={() => onNavigateToTab('social')}
                />

                {/* 1) Hero CTA */}
                <div className="mt-2">
                    <HeroStartRunCard
                        hero={data?.hero ?? null}
                        isLoading={isLoading}
                        onStartRun={onStartRun}
                        nearbyTargetCount={data?.nearbyTargets?.length ?? 0}
                        onSmartPlan={onSmartPlan}
                    />
                </div>

                {/* 
          Conditional ordering:
          If "被偷" events exist → BattleFeed comes BEFORE NearbyTargets
          Otherwise → NearbyTargets first
        */}
                <div className="mt-5 space-y-5">
                    {hasWarningEvents ? (
                        <>
                            {/* 3) Battle Feed (priority when "被偷" exists) */}
                            <BattleFeedMini
                                events={data?.battleFeed ?? []}
                                onCounterAttack={handleCounterAttack}
                                onViewEvent={handleViewEvent}
                                onTargetUnavailable={handleTargetUnavailable}
                                isLoading={isLoading}
                            />

                            {/* 2) Nearby Targets */}
                            <NearbyTargetsCarousel
                                targets={data?.nearbyTargets ?? []}
                                onGoToTarget={handleGoToTarget}
                                isLoading={isLoading}
                            />
                        </>
                    ) : (
                        <>
                            {/* 2) Nearby Targets */}
                            <NearbyTargetsCarousel
                                targets={data?.nearbyTargets ?? []}
                                onGoToTarget={handleGoToTarget}
                                isLoading={isLoading}
                            />

                            {/* 3) Battle Feed */}
                            <BattleFeedMini
                                events={data?.battleFeed ?? []}
                                onCounterAttack={handleCounterAttack}
                                onViewEvent={handleViewEvent}
                                onTargetUnavailable={handleTargetUnavailable}
                                isLoading={isLoading}
                            />
                        </>
                    )}

                    {/* 4) Daily Progress — direct import, no lazy */}
                    <DailyProgressBars
                        items={data?.dailyProgress ?? []}
                        onGoToMissions={handleGoToMissions}
                        isLoading={isLoading}
                    />

                    {/* My Planned Routes Section */}
                    <div className="px-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground/80 flex items-center gap-1.5">
                                <Route className="h-3.5 w-3.5 text-primary" />
                                我的规划路线
                            </h3>
                            <button
                                onClick={onSmartPlan}
                                className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 hover:bg-primary/20 transition-colors"
                            >
                                去规划
                            </button>
                        </div>

                        {isRoutesLoading ? (
                            <div className="flex h-24 items-center justify-center rounded-xl border border-white/5 bg-white/3">
                                <Loader2 className="h-5 w-5 animate-spin text-primary/50" />
                            </div>
                        ) : routesError || routes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/3 py-6 text-center">
                                <MapPin className="mb-2 h-5 w-5 text-foreground/15" />
                                <p className="text-[11px] text-foreground/40">{routesError ? '加载路线失败' : '暂无规划路线'}</p>
                                <button
                                    onClick={onSmartPlan}
                                    className="mt-2 text-[10px] font-semibold text-primary/80 underline decoration-primary/30 underline-offset-2"
                                >
                                    去规划第一条路线
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
                                {routes.map((route) => (
                                    <div
                                        key={route.id}
                                        className="flex-shrink-0 w-[200px] rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-white/8"
                                    >
                                        {/* Thumbnail Container */}
                                        <div className="mb-2.5 h-16 w-full rounded-lg bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden">
                                            <RouteThumbnail waypoints={route.waypoints} />
                                        </div>

                                        <h4 className="text-xs font-bold text-foreground mb-2 truncate">
                                            {route.name || '未命名路线'}
                                        </h4>

                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-foreground/40 flex items-center gap-1">
                                                    <TrendingUp className="h-2.5 w-2.5" />
                                                    距离
                                                </span>
                                                <span className="font-bold text-primary">{route.distance.toFixed(2)} km</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-foreground/40 flex items-center gap-1">
                                                    <MapPin className="h-2.5 w-2.5" />
                                                    面积
                                                </span>
                                                <span className="font-medium text-purple-400">{route.capture_area.toFixed(2)} km²</span>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-white/5">
                                                <span className="text-foreground/30 flex items-center gap-1 text-[9px]">
                                                    <Calendar className="h-2.5 w-2.5" />
                                                    {format(new Date(route.created_at), 'MM-dd')}
                                                </span>
                                                <button
                                                    onClick={onSmartPlan}
                                                    className="flex items-center gap-0.5 text-primary/60 hover:text-primary transition-colors font-medium"
                                                >
                                                    查看
                                                    <ChevronRight className="h-2.5 w-2.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 5) Leaderboard & Club — lazy loaded (heavy component) */}
                    <Suspense fallback={<LeaderboardFallback />}>
                        <LeaderboardMini
                            leaderboard={data?.leaderboardMini ?? []}
                            myRank={data?.myRank ?? null}
                            clubEvents={data?.clubMini ?? []}
                            isLoading={isLoading}
                        />
                    </Suspense>
                </div>

                {/* 6) Feedback button */}
                <div className="mt-8 mb-4 flex justify-center px-4">
                    <Link
                        href="/feedback"
                        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-foreground/40 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground/60 active:scale-95"
                    >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        问题反馈 · 体验建议
                    </Link>
                </div>
                <p className="text-center text-[10px] text-foreground/20 pb-4">
                    您的建议帮助我们改进游戏体验！
                </p>
            </div>
        </div>
    );
}

export const GameHomePage = memo(GameHomePageInner);
