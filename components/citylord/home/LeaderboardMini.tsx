'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Trophy, Crown, Medal, ChevronUp, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import type { RankItem } from '@/types/home';

/**
 * [Tech Lead] 状态定义与类型支持
 */
type LeaderboardTab = 'nearby' | 'city' | 'global';

interface LeaderboardMiniProps {
    initialLeaderboard?: RankItem[];
    myRank: RankItem | null;
    isLoadingInitial?: boolean;
}

// 通用数据拉取器
const fetcher = (url: string) => fetch(url).then(res => res.json());

function rankIcon(rank: number) {
    if (rank === 1) return <Crown className="h-3.5 w-3.5 text-amber-400" />;
    if (rank === 2) return <Medal className="h-3.5 w-3.5 text-slate-300" />;
    if (rank === 3) return <Medal className="h-3.5 w-3.5 text-amber-600" />;
    return <span className="text-[10px] font-bold text-foreground/40 w-3.5 text-center">{rank}</span>;
}

export function LeaderboardMini({ myRank, initialLeaderboard }: LeaderboardMiniProps) {
    const [activeTab, setActiveTab] = useState<LeaderboardTab>('nearby');

    /**
     * [Tech Lead] SWR 动态数据流
     * 自动监听 activeTab 变化并重新拉取
     */
    const { data: rankings, isLoading } = useSWR<{ leaderboard: RankItem[] }>(
        `/api/leaderboard?type=${activeTab}`,
        fetcher,
        { 
            fallbackData: activeTab === 'nearby' && initialLeaderboard 
                ? { leaderboard: initialLeaderboard } 
                : undefined 
        }
    );

    const leaderboardData = rankings?.leaderboard || [];

    // 计算排名差距提示
    const rankHint = useMemo(() => {
        if (!myRank) return null;
        const targetRank = Math.max(1, myRank.rank - 1);
        if (myRank.gapToTarget != null && myRank.gapToTarget > 0) {
            return `距第 ${targetRank} 名差 ${myRank.gapToTarget} 分`;
        }
        return null;
    }, [myRank]);

    return (
        <div className="px-4 relative">
            {/* Header 区域 - [Tech Lead] 骨架要求结构 */}
            <div className="flex items-center gap-4 mb-4">
                {/* 标题 */}
                <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-purple-500" />
                    <span className="font-medium text-slate-900 dark:text-white">查看排行</span>
                </div>

                {/* Tab 切换器 (药丸风格) - [Tech Lead] 动力学交互 */}
                <div className="flex bg-gray-800/60 rounded-full p-1 border border-gray-700/50">
                    {[
                        { id: 'nearby', label: '附近' },
                        { id: 'city', label: '同城' },
                        { id: 'global', label: '全服' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as LeaderboardTab)}
                            className={`px-4 py-1 rounded-full text-xs font-medium transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-purple-600/80 text-white shadow-sm'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content 容器 */}
            <div className="rounded-xl border border-white/10 bg-white/3 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="p-3"
                    >
                        {isLoading && !rankings ? (
                            /* [Tech Lead] 加载中 UI 容错 */
                            <div className="py-8 text-center space-y-3">
                                <div className="flex justify-center gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <p className="text-[10px] text-white/40">正在拉取活跃领主...</p>
                            </div>
                        ) : leaderboardData.length === 0 ? (
                            /* [Tech Lead] 空状态处理 */
                            <div className="py-8 text-center bg-white/2 rounded-lg m-2 border border-dashed border-white/5">
                                <Trophy className="mx-auto h-6 w-6 text-foreground/10 mb-2" />
                                <p className="text-xs text-foreground/30">当前范围暂无排名数据</p>
                            </div>
                        ) : (
                            /* 保持原本优秀的 Top 5 列表 UI */
                            <>
                                <div className="space-y-1.5">
                                    {leaderboardData.slice(0, 5).map((item) => (
                                        <div
                                            key={`mini-${item.name}-${item.rank}`}
                                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${item.isMe ? 'bg-primary/10 border border-primary/20' : 'hover:bg-white/5'
                                                }`}
                                        >
                                            <div className="w-4 flex justify-center">
                                                {rankIcon(item.rank)}
                                            </div>
                                            {item.avatar ? (
                                                <Image
                                                    src={item.avatar}
                                                    alt=""
                                                    width={20}
                                                    height={20}
                                                    className="h-5 w-5 rounded-full object-cover border border-white/10"
                                                    onError={(e) => { e.currentTarget.style.display = 'none' }}
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

                                {/* 当前用户排名 (如不在前五) */}
                                {myRank && !leaderboardData.some((r) => r.isMe) && (
                                    <div className="mt-2 pt-2 border-t border-white/5">
                                        <div className="flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1.5">
                                            <span className="text-[10px] font-bold text-primary w-4 text-center">
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

                                        {/* 动态排名提示 */}
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
                </AnimatePresence>
            </div>
        </div>
    );
}
