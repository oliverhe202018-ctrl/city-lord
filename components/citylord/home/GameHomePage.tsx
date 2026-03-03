'use client';

import { useState, useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { useHomeData } from '@/hooks/useHomeData';
import { HomeTopBar } from './HomeTopBar';
import { HeroStartRunCard } from './HeroStartRunCard';
import { HomeSkeleton } from './HomeSkeleton';
import { NearbyTargetsCarousel } from './NearbyTargetsCarousel';
import { BattleFeedMini } from './BattleFeedMini';
import { DailyProgressBars } from './DailyProgressBars';
import { FeedbackDialog } from './FeedbackDialog';
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
}

function GameHomePageInner({ onStartRun, onNavigateToMap, onNavigateToTab }: GameHomePageProps) {
    const { data, isLoading } = useHomeData();
    const [feedbackOpen, setFeedbackOpen] = useState(false);

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
        <div className="flex h-full flex-col bg-[#0f172a]">
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
                    <button
                        onClick={() => setFeedbackOpen(true)}
                        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-foreground/40 transition-all hover:border-primary/30 hover:bg-primary/5 hover:text-foreground/60 active:scale-95"
                    >
                        <MessageSquarePlus className="h-3.5 w-3.5" />
                        问题反馈 · 体验建议
                    </button>
                </div>
                <p className="text-center text-[10px] text-foreground/20 pb-4">
                    您的建议帮助我们改进游戏体验！
                </p>
            </div>

            {/* Feedback Dialog */}
            <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
        </div>
    );
}

export const GameHomePage = memo(GameHomePageInner);
