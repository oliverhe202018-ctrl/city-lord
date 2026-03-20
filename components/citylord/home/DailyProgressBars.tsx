'use client';

import { Hexagon, Swords, Share2, ChevronRight, Zap } from 'lucide-react';

export interface DailyProgressBarItem {
    key: string;
    label: string;
    current: number;
    total: number;
    status: string; // 'pending' | 'completed' | 'claimed'
    icon?: string;
}

interface DailyProgressBarsProps {
    items: DailyProgressBarItem[];
    onGoToMissions: (options?: { initialFilter?: 'all' | 'daily' | 'weekly' }) => void;
    isLoading?: boolean;
    error?: string;
}

const iconMap: Record<string, React.ReactNode> = {
    Hexagon: <Hexagon className="h-3.5 w-3.5" />,
    Swords: <Swords className="h-3.5 w-3.5" />,
    Share2: <Share2 className="h-3.5 w-3.5" />,
};

export function DailyProgressBars({ items, onGoToMissions, isLoading, error }: DailyProgressBarsProps) {
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

    if (error) {
        return (
            <div className="px-4">
                <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 py-6 text-center">
                    <p className="text-[11px] text-red-400">加载失败，请重试</p>
                </div>
            </div>
        );
    }

    const totalMissions = items.length;
    const completedMissions = items.filter(m => m.status === 'completed' || m.status === 'claimed' || (m as any).isCompleted).length;
    const overallPct = totalMissions > 0 ? (completedMissions / totalMissions) * 100 : 0;

    const displayItems = items.slice(0, 3);
    const hiddenCount = totalMissions > 3 ? totalMissions - 3 : 0;

    return (
        <div className="px-4">
            <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-bold text-foreground/80">今日任务进度</h3>
                <button
                    onClick={() => onGoToMissions({ initialFilter: 'daily' })}
                    className="flex items-center gap-0.5 text-[10px] text-primary hover:text-primary/80 transition-colors"
                >
                    任务中心
                    <ChevronRight className="h-3 w-3" />
                </button>
            </div>

            {totalMissions > 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/3 p-3">
                    {/* Overall Progress */}
                    <div className="mb-3.5 border-b border-white/5 pb-2.5">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] font-medium text-foreground/60 flex items-center gap-1">
                                <Zap className="h-3 w-3 text-yellow-400" />
                                总体完成情况
                            </span>
                            <span className="text-[11px] font-bold text-primary">
                                {completedMissions} / {totalMissions}
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-primary transition-all duration-700"
                                style={{ width: `${Math.min(100, Math.max(0, overallPct))}%` }}
                            />
                        </div>
                    </div>

                    {/* Task List */}
                    <div className="space-y-3">
                        {displayItems.map((item) => {
                            const isComplete = item.status === 'completed' || item.status === 'claimed' || (item as any).isCompleted;
                            const isOngoing = !isComplete && item.current > 0;
                            const pct = item.total > 0 ? Math.min((item.current / item.total) * 100, 100) : 0;

                            let statusColor = "text-foreground/40";
                            let barColor = "bg-white/10";
                            
                            if (isComplete) {
                                statusColor = "text-emerald-400";
                                barColor = "bg-emerald-400";
                            } else if (isOngoing) {
                                statusColor = "text-cyan-400";
                                barColor = "bg-cyan-400";
                            }

                            return (
                                <div key={item.key} onClick={() => onGoToMissions({ initialFilter: 'daily' })} className="cursor-pointer active:scale-[0.99] transition-transform">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5 text-xs min-w-0">
                                            <span className={statusColor}>
                                                {iconMap[item.icon || 'Hexagon'] || <Hexagon className="h-3.5 w-3.5" />}
                                            </span>
                                            <span className={`font-medium truncate ${isComplete ? 'text-foreground/50 line-through' : 'text-foreground/80'}`}>
                                                {item.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className="text-[10px] text-foreground/40">
                                                {item.current}/{item.total}
                                            </span>
                                            {isComplete && (
                                                <span className="text-[10px] font-bold text-emerald-400">✓</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {hiddenCount > 0 && (
                        <div className="mt-2 text-center border-t border-white/5 pt-1.5">
                            <span className="text-[9px] text-foreground/30">
                                还有 {hiddenCount} 项任务未显示
                            </span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/3 py-5 text-center">
                    <p className="text-[11px] text-foreground/30">今日暂无每日任务</p>
                </div>
            )}
        </div>
    );
}
