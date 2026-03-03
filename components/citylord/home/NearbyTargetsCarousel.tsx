'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { MapPin, Zap, AlertTriangle, ChevronRight, Crosshair, Unlock, TrendingUp, ArrowUpDown } from 'lucide-react';
import type { Target } from '@/types/home';

interface NearbyTargetsCarouselProps {
    targets: Target[];
    onGoToTarget: (target: Target) => void;
    isLoading?: boolean;
}

type SortKey = 'default' | 'reward' | 'risk' | 'distance';

const sortOptions: { key: SortKey; label: string }[] = [
    { key: 'default', label: '推荐' },
    { key: 'reward', label: '高奖励' },
    { key: 'risk', label: '低风险' },
    { key: 'distance', label: '最近' },
];

const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    attack: { label: '可抢', color: 'text-red-400 bg-red-400/15 border-red-400/30', icon: <Crosshair className="h-3 w-3" /> },
    defend: { label: '可守', color: 'text-blue-400 bg-blue-400/15 border-blue-400/30', icon: <Crosshair className="h-3 w-3" /> },
    claim: { label: '可占', color: 'text-emerald-400 bg-emerald-400/15 border-emerald-400/30', icon: <Unlock className="h-3 w-3" /> },
    hotspot: { label: '热门', color: 'text-amber-400 bg-amber-400/15 border-amber-400/30', icon: <TrendingUp className="h-3 w-3" /> },
};

const riskConfig: Record<string, { label: string; color: string; order: number }> = {
    low: { label: '低风险', color: 'text-emerald-400', order: 0 },
    med: { label: '中风险', color: 'text-amber-400', order: 1 },
    high: { label: '高风险', color: 'text-red-400', order: 2 },
};

/** Distance dead-zone: changes < 30m don't trigger reorder */
const DISTANCE_DEADZONE = 30;

function formatDistance(meters: number): string {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

/** Extract numeric reward from rewardEstimate string like "+18 分" */
function parseReward(s: string): number {
    const match = s.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
}

/**
 * Stable sort comparator: preserves original order when primary key is equal
 * (or within dead-zone for distance).
 */
function stableSort<T>(arr: T[], compare: (a: T, b: T) => number): T[] {
    const indexed = arr.map((item, idx) => ({ item, idx }));
    indexed.sort((a, b) => {
        const cmp = compare(a.item, b.item);
        return cmp !== 0 ? cmp : a.idx - b.idx; // preserve original order on tie
    });
    return indexed.map(({ item }) => item);
}

function TargetCard({ target, onGoToTarget }: { target: Target; onGoToTarget: (t: Target) => void }) {
    const tConfig = typeConfig[target.type] || typeConfig.claim;
    const rConfig = riskConfig[target.riskLevel] || riskConfig.low;

    return (
        <div className="flex-shrink-0 w-[240px] rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-white/8">
            {/* Type badge + distance */}
            <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tConfig.color}`}>
                    {tConfig.icon}
                    {tConfig.label}
                </span>
                <span className="flex items-center gap-0.5 text-[10px] text-foreground/40">
                    <MapPin className="h-2.5 w-2.5" />
                    {formatDistance(target.distanceMeters)}
                </span>
            </div>

            {/* Title */}
            <h4 className="text-sm font-bold text-foreground mb-1.5 truncate">{target.title}</h4>

            {/* Reward + Risk */}
            <div className="flex items-center justify-between mb-3">
                <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Zap className="h-3 w-3" />
                    {target.rewardEstimate}
                </span>
                <span className={`flex items-center gap-1 text-[10px] ${rConfig.color}`}>
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {target.riskLabel}
                </span>
            </div>

            {/* CTA */}
            <button
                onClick={() => onGoToTarget(target)}
                className="flex w-full items-center justify-center gap-1 rounded-lg bg-primary/20 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/30 active:scale-[0.97]"
            >
                去这里
                <ChevronRight className="h-3 w-3" />
            </button>
        </div>
    );
}

function SkeletonCard() {
    return (
        <div className="flex-shrink-0 w-[240px] rounded-xl border border-white/5 bg-white/5 p-3 animate-pulse">
            <div className="flex justify-between mb-2">
                <div className="h-4 w-12 rounded bg-white/10" />
                <div className="h-3 w-10 rounded bg-white/10" />
            </div>
            <div className="h-4 w-3/4 rounded bg-white/10 mb-1.5" />
            <div className="h-3 w-full rounded bg-white/8 mb-3" />
            <div className="h-7 w-full rounded-lg bg-white/10" />
        </div>
    );
}

export function NearbyTargetsCarousel({ targets, onGoToTarget, isLoading }: NearbyTargetsCarouselProps) {
    const [sortKey, setSortKey] = useState<SortKey>('default');
    const scrollRef = useRef<HTMLDivElement>(null);
    const isEmpty = !isLoading && targets.length === 0;

    // Save and restore scroll position on sort change
    const handleSortChange = useCallback((key: SortKey) => {
        // Save current scroll position
        const scrollPos = scrollRef.current?.scrollLeft ?? 0;
        setSortKey(key);
        // Restore after React re-render
        requestAnimationFrame(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollLeft = scrollPos;
            }
        });
    }, []);

    const sortedTargets = useMemo(() => {
        if (sortKey === 'default') return targets;
        switch (sortKey) {
            case 'reward':
                return stableSort(targets, (a, b) =>
                    parseReward(b.rewardEstimate) - parseReward(a.rewardEstimate)
                );
            case 'risk':
                return stableSort(targets, (a, b) =>
                    (riskConfig[a.riskLevel]?.order ?? 1) - (riskConfig[b.riskLevel]?.order ?? 1)
                );
            case 'distance':
                return stableSort(targets, (a, b) => {
                    const diff = a.distanceMeters - b.distanceMeters;
                    // Dead-zone: if distance difference < 30m, treat as equal
                    if (Math.abs(diff) < DISTANCE_DEADZONE) return 0;
                    return diff;
                });
            default:
                return targets;
        }
    }, [targets, sortKey]);

    return (
        <div className="px-4">
            {/* Header with sort pills */}
            <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground/80 flex items-center gap-1.5">
                    <Crosshair className="h-3.5 w-3.5 text-primary" />
                    附近可行动目标
                    {targets.length > 0 && (
                        <span className="text-[10px] font-normal text-foreground/30 ml-1">
                            {targets.length}个
                        </span>
                    )}
                </h3>
            </div>

            {/* Sort filter pills — fixed height container to prevent layout shift */}
            {!isEmpty && targets.length > 1 && (
                <div className="mb-2.5 flex items-center gap-1 h-6">
                    <ArrowUpDown className="h-3 w-3 text-foreground/25 mr-0.5" />
                    {sortOptions.map((opt) => (
                        <button
                            key={opt.key}
                            onClick={() => handleSortChange(opt.key)}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${sortKey === opt.key
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'bg-white/5 text-foreground/35 border border-transparent hover:text-foreground/50'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}

            {isEmpty ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-white/3 py-8 text-center">
                    <MapPin className="mx-auto h-6 w-6 text-foreground/20 mb-2" />
                    <p className="text-xs text-foreground/40">暂无附近目标</p>
                    <p className="text-[10px] text-foreground/25 mt-1">试试手动选择区域查看更多</p>
                </div>
            ) : (
                <div
                    ref={scrollRef}
                    className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none [&::-webkit-scrollbar]:hidden"
                >
                    {isLoading
                        ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
                        : sortedTargets.map((t) => (
                            <TargetCard key={t.id} target={t} onGoToTarget={onGoToTarget} />
                        ))
                    }
                    {!isLoading && targets.length > 3 && (
                        <div className="flex-shrink-0 flex items-center">
                            <button className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors">
                                查看更多
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
