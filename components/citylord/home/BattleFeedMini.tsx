'use client';

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Swords, Trophy, Share2, AlertTriangle, Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { BattleEvent } from '@/types/home';

interface BattleFeedMiniProps {
    events: BattleEvent[];
    onCounterAttack: (event: BattleEvent) => void;
    onViewEvent: (event: BattleEvent) => void;
    /** Called when counter-attack target is unavailable */
    onTargetUnavailable?: (event: BattleEvent) => void;
    isLoading?: boolean;
}

const COLLAPSED_COUNT = 3;
const MAX_EXPANDED = 20;

type FeedCategory = 'claimed' | 'under_attack' | 'attacked_others' | 'other';

const eventIcons: Record<string, React.ReactNode> = {
    lost: <AlertTriangle className="h-3.5 w-3.5" />,
    defend: <Shield className="h-3.5 w-3.5" />,
    win: <Trophy className="h-3.5 w-3.5" />,
    share: <Share2 className="h-3.5 w-3.5" />,
};

const fallbackMockEvents: BattleEvent[] = [
    {
        id: 'mock-claimed',
        type: 'win',
        text: '你成功扩张并获取了 2 块新领地',
        createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        ctaType: 'see',
        ctaLabel: '查看',
        severity: 'info',
    },
    {
        id: 'mock-under-attack',
        type: 'lost',
        text: '你的东侧领地遭到攻击并失守 1 块',
        createdAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
        relatedTargetId: 'mock-target-1',
        ctaType: 'counter',
        ctaLabel: '反击',
        severity: 'warn',
    },
    {
        id: 'mock-attacked-others',
        type: 'share',
        text: '你发起突袭并夺取了对手领地',
        createdAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
        ctaType: 'see',
        ctaLabel: '战报',
        severity: 'info',
    },
];

function resolveFeedCategory(event: BattleEvent): FeedCategory {
    const text = event.text.toLowerCase();
    if (event.type === 'lost' || text.includes('被攻击') || text.includes('失守') || text.includes('偷走')) {
        return 'under_attack';
    }
    if (text.includes('攻击') || text.includes('突袭') || text.includes('进攻')) {
        return 'attacked_others';
    }
    if (event.type === 'win' || text.includes('占领') || text.includes('扩张') || text.includes('获取领地') || text.includes('夺取')) {
        return 'claimed';
    }
    return 'other';
}

function getCategoryClasses(category: FeedCategory): string {
    if (category === 'claimed') return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (category === 'under_attack') return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (category === 'attacked_others') return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
}

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    return `${Math.floor(hours / 24)} 天前`;
}

function EventRow({ event, onCounterAttack, onViewEvent }: {
    event: BattleEvent;
    onCounterAttack: (e: BattleEvent) => void;
    onViewEvent: (e: BattleEvent) => void;
}) {
    const category = resolveFeedCategory(event);
    const colorClass = getCategoryClasses(category);
    const isWarning = event.severity === 'warn';

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
            transition={{ duration: 0.3 }}
            className={`flex items-start gap-2.5 rounded-xl p-2.5 transition-all ${isWarning
                ? 'border border-red-500/20 bg-red-500/5'
                : 'border border-transparent bg-white/3'
                }`}
        >
            {/* Icon */}
            <div className={`flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border ${colorClass}`}>
                {eventIcons[event.type]}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/80 leading-relaxed">{event.text}</p>
                <div className="mt-1 flex items-center gap-1.5">
                    <Clock className="h-2.5 w-2.5 text-foreground/30" />
                    <span className="text-[10px] text-foreground/30">{timeAgo(event.createdAt)}</span>
                </div>

                {/* Counter-attack tip — only for "lost" events */}
                {isWarning && event.ctaType === 'counter' && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-400/80"
                    >
                        <Zap className="h-2.5 w-2.5" />
                        <span>立即反击可恢复领地奖励！</span>
                    </motion.div>
                )}
            </div>

            {/* CTA */}
            <button
                onClick={() => event.ctaType === 'counter' ? onCounterAttack(event) : onViewEvent(event)}
                className={`flex-shrink-0 self-center rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${event.ctaType === 'counter'
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.15)]'
                    : 'bg-white/5 text-foreground/50 hover:bg-white/10'
                    }`}
            >
                {event.ctaLabel}
            </button>
        </motion.div>
    );
}

export function BattleFeedMini({ events, onCounterAttack, onViewEvent, onTargetUnavailable, isLoading }: BattleFeedMiniProps) {
    const [expanded, setExpanded] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Sort: warn first, then by createdAt desc
    const mergedEvents = useMemo(() => {
        if (events.length > 0) return events;
        return fallbackMockEvents;
    }, [events]);

    const sortedEvents = useMemo(() => {
        return [...mergedEvents].sort((a, b) => {
            if (a.severity === 'warn' && b.severity !== 'warn') return -1;
            if (a.severity !== 'warn' && b.severity === 'warn') return 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [mergedEvents]);

    const hasWarning = sortedEvents.some((e) => e.severity === 'warn');
    const hasMore = sortedEvents.length > COLLAPSED_COUNT;

    const warnCount = useMemo(() => sortedEvents.filter(e => e.severity === 'warn').length, [sortedEvents]);

    // Default 3, expanded max 20
    const visibleEvents = expanded
        ? sortedEvents.slice(0, MAX_EXPANDED)
        : sortedEvents.slice(0, COLLAPSED_COUNT);

    // Counter-attack handler with target-exists check
    const handleCounterAttack = useCallback((event: BattleEvent) => {
        if (!event.relatedTargetId) {
            // Target unavailable
            setToastMsg('目标已变化，推荐最近可反击目标');
            setTimeout(() => setToastMsg(null), 3000);
            onTargetUnavailable?.(event);
            return;
        }
        onCounterAttack(event);
    }, [onCounterAttack, onTargetUnavailable]);

    return (
        <div className="px-4 relative">
            {/* Toast notification */}
            <AnimatePresence>
                {toastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute -top-2 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-amber-500/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm whitespace-nowrap"
                    >
                        {toastMsg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="mb-2 flex items-center justify-between">
                <h3 className={`text-sm font-bold flex items-center gap-1.5 ${hasWarning ? 'text-red-400' : 'text-foreground/80'
                    }`}>
                    <Swords className={`h-3.5 w-3.5 ${hasWarning ? 'text-red-400' : 'text-primary'}`} />
                    你的领地正在发生什么
                    {hasWarning && (
                        <span className="ml-1 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400 animate-pulse">
                            {warnCount}
                        </span>
                    )}
                </h3>
            </div>

            {/* Warning banner — appears when territories are under attack */}
            {hasWarning && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2"
                >
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                    <span className="text-[11px] text-red-300/90">
                        你有 {warnCount} 块领地被偷了！立即反击恢复奖励
                    </span>
                </motion.div>
            )}

            {isLoading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white/3 p-2.5 animate-pulse">
                            <div className="h-7 w-7 rounded-lg bg-white/10" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-3/4 rounded bg-white/10" />
                                <div className="h-2 w-1/3 rounded bg-white/5" />
                            </div>
                            <div className="h-6 w-12 rounded-lg bg-white/10" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {events.length === 0 && (
                        <div className="mb-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200/90">
                            当前为演示动态：已预置“获取领地 / 领地被攻击 / 攻击他人领地”三类渲染分支
                        </div>
                    )}
                    <AnimatePresence mode="popLayout">
                        <div className="space-y-2">
                            {visibleEvents.map((event) => (
                                <EventRow
                                    key={event.id}
                                    event={event}
                                    onCounterAttack={handleCounterAttack}
                                    onViewEvent={onViewEvent}
                                />
                            ))}
                        </div>
                    </AnimatePresence>

                    {/* Show more / show less toggle */}
                    {hasMore && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg bg-white/5 py-1.5 text-[11px] text-foreground/40 hover:bg-white/8 hover:text-foreground/60 transition-colors"
                        >
                            {expanded ? (
                                <>
                                    收起 <ChevronUp className="h-3 w-3" />
                                </>
                            ) : (
                                <>
                                    查看更多（{Math.min(sortedEvents.length, MAX_EXPANDED) - COLLAPSED_COUNT}） <ChevronDown className="h-3 w-3" />
                                </>
                            )}
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
