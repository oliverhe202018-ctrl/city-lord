'use client';

import { Hexagon, Swords, Share2, ChevronRight } from 'lucide-react';
import type { ProgressItem } from '@/types/home';

interface DailyProgressBarsProps {
    items: ProgressItem[];
    onGoToMissions: () => void;
    isLoading?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
    Hexagon: <Hexagon className="h-3.5 w-3.5" />,
    Swords: <Swords className="h-3.5 w-3.5" />,
    Share2: <Share2 className="h-3.5 w-3.5" />,
};

const barColors = [
    'bg-cyan-400',
    'bg-amber-400',
    'bg-purple-400',
];

export function DailyProgressBars({ items, onGoToMissions, isLoading }: DailyProgressBarsProps) {
    if (isLoading) {
        return (
            <div className="px-4">
                <div className="h-4 w-24 rounded bg-white/10 mb-3 animate-pulse" />
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="animate-pulse">
                            <div className="flex justify-between mb-1">
                                <div className="h-3 w-12 rounded bg-white/10" />
                                <div className="h-3 w-16 rounded bg-white/10" />
                            </div>
                            <div className="h-2 w-full rounded-full bg-white/5" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="px-4">
            <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-bold text-foreground/80">今日进度</h3>
                <button
                    onClick={onGoToMissions}
                    className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                    任务中心
                    <ChevronRight className="h-3 w-3" />
                </button>
            </div>

            <div className="space-y-3 rounded-xl border border-white/10 bg-white/3 p-3">
                {items.map((item, idx) => {
                    const pct = item.total > 0 ? Math.min((item.current / item.total) * 100, 100) : 0;
                    const isComplete = item.current >= item.total;

                    return (
                        <div key={item.key}>
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5 text-xs">
                                    <span className={barColors[idx] ? barColors[idx].replace('bg-', 'text-') : 'text-white'}>
                                        {iconMap[item.icon] || <Hexagon className="h-3.5 w-3.5" />}
                                    </span>
                                    <span className="font-medium text-foreground/70">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-foreground/50">
                                        {item.current}/{item.total}
                                    </span>
                                    {item.ctaLabel && !isComplete && (
                                        <button
                                            onClick={onGoToMissions}
                                            className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                                        >
                                            {item.ctaLabel}
                                        </button>
                                    )}
                                    {isComplete && (
                                        <span className="text-[10px] font-medium text-emerald-400">✓</span>
                                    )}
                                </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${isComplete
                                            ? 'bg-emerald-400'
                                            : barColors[idx] || 'bg-primary'
                                        }`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
