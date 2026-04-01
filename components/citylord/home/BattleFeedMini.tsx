'use client';

import { useEffect, useMemo } from 'react';
import { Coins, AlertTriangle, Swords, Wind } from 'lucide-react';
import type { BattleEvent } from '@/types/home';
import { useMessageStore } from '@/store/useMessageStore';
import type { SystemMessage } from '@/types/system-message';

interface BattleFeedMiniProps {
    events: BattleEvent[];
    onCounterAttack: (event: BattleEvent) => void;
    onViewEvent: (event: BattleEvent) => void;
    /** Called when counter-attack target is unavailable */
    onTargetUnavailable?: (event: BattleEvent) => void;
    isLoading?: boolean;
}

const HOME_FEED_LIMIT = 5;

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
}

function TerritoryMessageRow({ message, onViewEvent }: {
    message: SystemMessage;
    onViewEvent: (e: BattleEvent) => void;
}) {
    const isRevenue = message.type === 'revenue';
    const iconClass = isRevenue
        ? 'h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400'
        : 'h-3.5 w-3.5 text-red-600 dark:text-red-400';
    const textClass = isRevenue
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-600 dark:text-red-400';

    return (
        <button
            onClick={() => onViewEvent({
                id: message.id,
                type: message.type === 'revenue' ? 'win' : 'lost',
                text: message.content,
                createdAt: message.createdAt,
                ctaType: message.type === 'combat_alert' ? 'counter' : 'see',
                ctaLabel: message.type === 'combat_alert' ? '反击' : '查看',
                severity: message.type === 'combat_alert' ? 'warn' : 'info',
            })}
            className="w-full flex items-center gap-2 py-1.5 text-left border-b border-border/40 last:border-b-0"
        >
            <div className="shrink-0 mt-0.5">
                {isRevenue ? <Coins className={iconClass} /> : <AlertTriangle className={iconClass} />}
            </div>
            <div className="min-w-0 flex-1">
                <p className={`text-xs leading-5 truncate ${textClass}`}>{message.content}</p>
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground/70">{timeAgo(message.createdAt)}</span>
        </button>
    );
}

export function BattleFeedMini({ events, onCounterAttack, onViewEvent, onTargetUnavailable, isLoading }: BattleFeedMiniProps) {
    const {
        systemMessages,
        isLoading: isSystemLoading,
        fetchSystemMessages
    } = useMessageStore((s) => ({
        systemMessages: s.systemMessages,
        isLoading: s.isLoading,
        fetchSystemMessages: s.fetchSystemMessages
    }));

    useEffect(() => {
        fetchSystemMessages();
    }, [fetchSystemMessages]);

    const feedMessages = useMemo(() => {
        return [...systemMessages]
            .filter((msg) => msg.type === 'revenue' || msg.type === 'combat_alert')
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, HOME_FEED_LIMIT);
    }, [systemMessages]);

    const hasWarning = feedMessages.some((m) => m.type === 'combat_alert');
    const loading = Boolean(isLoading || isSystemLoading);
    void events;
    void onCounterAttack;
    void onTargetUnavailable;

    return (
        <div className="px-4">
            <div className="mb-2 flex items-center justify-between">
                <h3 className={`text-sm font-bold flex items-center gap-1.5 ${hasWarning ? 'text-red-400' : 'text-foreground/80'
                    }`}>
                    <Swords className={`h-3.5 w-3.5 ${hasWarning ? 'text-red-400' : 'text-primary'}`} />
                    你的领地正在发生什么
                </h3>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 py-1.5 animate-pulse">
                            <div className="h-3.5 w-3.5 rounded bg-muted" />
                            <div className="h-3 flex-1 rounded bg-muted" />
                            <div className="h-2.5 w-10 rounded bg-muted/70" />
                        </div>
                    ))}
                </div>
            ) : (
                <>
                    {feedMessages.length === 0 ? (
                        <div className="py-4 flex items-center gap-2 text-muted-foreground">
                            <Wind className="h-4 w-4 animate-pulse" />
                            <p className="text-xs">一切平静，您的领地正在稳步运转...</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {feedMessages.map((message) => (
                                <TerritoryMessageRow
                                    key={message.id}
                                    message={message}
                                    onViewEvent={onViewEvent}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
