'use client';

import { useState, useMemo, useCallback } from 'react';
import { Trophy, Users, Crown, Medal, ChevronUp, TrendingUp, MapPin, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RankItem, ClubEvent } from '@/types/home';

interface LeaderboardMiniProps {
    leaderboard: RankItem[];
    myRank: RankItem | null;
    clubEvents: ClubEvent[];
    isLoading?: boolean;
}

type TabId = 'leaderboard' | 'club';
type LeaderboardScope = 'nearby' | 'city' | 'global';

/** Only 'nearby' is currently supported by the backend */
const SUPPORTED_SCOPES: LeaderboardScope[] = ['nearby'];

const scopeOptions: { key: LeaderboardScope; label: string }[] = [
    { key: 'nearby', label: '附近' },
    { key: 'city', label: '全城' },
    { key: 'global', label: '全国' },
];

function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
}

function rankEmoji(rank: number) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
}

const rankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-3.5 w-3.5 text-amber-400" />;
    if (rank === 2) return <Medal className="h-3.5 w-3.5 text-slate-300" />;
    if (rank === 3) return <Medal className="h-3.5 w-3.5 text-amber-600" />;
    return <span className="text-[10px] font-bold text-foreground/40 w-3.5 text-center">{rank}</span>;
};

export function LeaderboardMini({ leaderboard, myRank, clubEvents, isLoading }: LeaderboardMiniProps) {
    const [activeTab, setActiveTab] = useState<TabId>('leaderboard');
    const [scope, setScope] = useState<LeaderboardScope>('nearby');
    const [scopeToast, setScopeToast] = useState<string | null>(null);

    // Calculate rank change hint for the user
    const rankHint = useMemo(() => {
        if (!myRank) return null;
        const targetRank = Math.max(1, myRank.rank - 1);
        if (myRank.gapToTarget != null && myRank.gapToTarget > 0) {
            return `距第 ${targetRank} 名差 ${myRank.gapToTarget} 分`;
        }
        return null;
    }, [myRank]);

    const handleScopeClick = useCallback((key: LeaderboardScope) => {
        if (SUPPORTED_SCOPES.includes(key)) {
            setScope(key);
            return;
        }
        // Unsupported scope — show toast
        setScopeToast('该范围即将支持，敬请期待');
        setTimeout(() => setScopeToast(null), 2500);
    }, []);

    if (isLoading) {
        return (
            <div className="px-4">
                <div className="h-8 w-40 rounded bg-white/10 mb-3 animate-pulse" />
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-2 animate-pulse">
                            <div className="h-4 w-4 rounded bg-white/10" />
                            <div className="h-3 w-20 rounded bg-white/10" />
                            <div className="flex-1" />
                            <div className="h-3 w-12 rounded bg-white/10" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 relative">
            {/* Scope toast */}
            <AnimatePresence>
                {scopeToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute -top-2 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-primary/90 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm whitespace-nowrap"
                    >
                        {scopeToast}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 mb-3 rounded-full bg-white/5 p-0.5 w-fit border border-white/10">
                {[
                    { id: 'leaderboard' as TabId, label: '附近排行', icon: <Trophy className="h-3 w-3" /> },
                    { id: 'club' as TabId, label: '俱乐部动态', icon: <Users className="h-3 w-3" /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`relative flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${activeTab === tab.id ? 'text-white' : 'text-white/40 hover:text-white/60'
                            }`}
                    >
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="leaderboardTabBg"
                                className="absolute inset-0 rounded-full bg-primary/25 border border-primary/30"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            />
                        )}
                        <span className="relative z-10">{tab.icon}</span>
                        <span className="relative z-10">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
                <AnimatePresence mode="wait">
                    {activeTab === 'leaderboard' ? (
                        <motion.div
                            key="leaderboard"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ duration: 0.2 }}
                            className="p-3"
                        >
                            {/* Scope filter pills — with disabled state for unsupported scopes */}
                            <div className="flex items-center gap-1 mb-3">
                                <MapPin className="h-2.5 w-2.5 text-foreground/25 mr-0.5" />
                                {scopeOptions.map((opt) => {
                                    const isSupported = SUPPORTED_SCOPES.includes(opt.key);
                                    const isActive = scope === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            onClick={() => handleScopeClick(opt.key)}
                                            className={`relative rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${isActive
                                                ? 'bg-primary/20 text-primary border border-primary/30'
                                                : isSupported
                                                    ? 'bg-white/5 text-foreground/30 border border-transparent hover:text-foreground/45'
                                                    : 'bg-white/3 text-foreground/20 border border-transparent cursor-not-allowed opacity-60'
                                                }`}
                                        >
                                            {opt.label}
                                            {/* "即将支持" badge for unsupported scopes */}
                                            {!isSupported && (
                                                <span className="ml-0.5 text-[8px] text-foreground/25">
                                                    即将
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {leaderboard.length === 0 ? (
                                <div className="py-4 text-center">
                                    <Trophy className="mx-auto h-5 w-5 text-foreground/20 mb-1" />
                                    <p className="text-xs text-foreground/40">暂无排行数据</p>
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        {leaderboard.slice(0, 5).map((item) => (
                                            <div
                                                key={item.rank}
                                                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${item.isMe ? 'bg-primary/10 border border-primary/20' : ''
                                                    }`}
                                            >
                                                {rankIcon(item.rank)}
                                                {item.avatar ? (
                                                    <img
                                                        src={item.avatar}
                                                        alt=""
                                                        className="h-5 w-5 rounded-full object-cover border border-white/10"
                                                    />
                                                ) : (
                                                    <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-foreground/40">
                                                        {item.name.charAt(0)}
                                                    </div>
                                                )}
                                                <span className="flex-1 text-xs font-medium text-foreground/70 truncate">
                                                    {item.name}
                                                    {item.isMe && <span className="ml-1 text-[9px] text-primary/80">（我）</span>}
                                                </span>
                                                <span className="text-[11px] font-bold text-foreground/50">
                                                    {item.score.toLocaleString()} 分
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* My rank — when not in top 5 */}
                                    {myRank && !leaderboard.some((r) => r.isMe) && (
                                        <div className="mt-2 pt-2 border-t border-white/5">
                                            <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5">
                                                <span className="text-[10px] font-bold text-primary w-3.5 text-center">
                                                    {myRank.rank}
                                                </span>
                                                <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">
                                                    我
                                                </div>
                                                <span className="flex-1 text-xs font-medium text-foreground/70">
                                                    {myRank.name}
                                                </span>
                                                <span className="text-[11px] font-bold text-foreground/50">
                                                    {myRank.score.toLocaleString()} 分
                                                </span>
                                            </div>

                                            {/* Dynamic rank hint */}
                                            {rankHint && (
                                                <div className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-primary/80">
                                                    <TrendingUp className="h-2.5 w-2.5" />
                                                    <span>{rankHint}</span>
                                                    <ChevronUp className="h-2.5 w-2.5" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="club"
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="p-3"
                        >
                            {clubEvents.length === 0 ? (
                                <div className="py-4 text-center">
                                    <Users className="mx-auto h-5 w-5 text-foreground/20 mb-1" />
                                    <p className="text-xs text-foreground/40">暂无俱乐部动态</p>
                                    <p className="text-[10px] text-foreground/25 mt-0.5">加入俱乐部一起占地吧</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {clubEvents.map((ev) => (
                                        <div key={ev.id} className="flex items-start gap-2">
                                            <div className="flex-shrink-0 mt-0.5 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                                                <Users className="h-2.5 w-2.5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-foreground/70">
                                                    <span className="font-semibold text-foreground/90">{ev.memberName}</span>{' '}
                                                    {ev.text}
                                                </p>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Clock className="h-2 w-2 text-foreground/25" />
                                                    <span className="text-[10px] text-foreground/30">{timeAgo(ev.createdAt)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
