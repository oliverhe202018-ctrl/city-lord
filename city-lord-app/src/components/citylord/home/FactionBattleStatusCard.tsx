'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, Shield, Hexagon } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/fetch-shim';


export function FactionBattleStatusCard() {
    const userFaction = useGameStore(state => state.faction);

    // Fetch faction stats from API
    const [factionStats, setFactionStats] = useState<{
        red_area?: number;
        blue_area?: number;
        redArea?: number;
        blueArea?: number;
        red_user_count?: number;
        blue_user_count?: number;
        red_faction?: number;
        blue_faction?: number;
        bonus?: { RED: number; BLUE: number };
    } | null>(null);

    const [dailyStat, setDailyStat] = useState<{
        redCount: number;
        blueCount: number;
    } | null>(null);

    useEffect(() => {
        apiFetch(`/api/faction/stats`, { credentials: 'include' })
            .then(res => res.ok ? res.json() : null)
            .then(setFactionStats)
            .catch(err => console.error('Failed to fetch faction stats:', err));

        apiFetch(`/api/faction/daily-stats`, { credentials: 'include' })
            .then(res => res.ok ? res.json() : null)
            .then(setDailyStat)
            .catch(err => console.error('Failed to fetch daily stats:', err));
    }, []);

    // Member counts: prioritize dailyStat (snapshot), then factionStats
    const redMembers = dailyStat?.redCount ?? factionStats?.red_user_count ?? factionStats?.red_faction ?? 0;
    const blueMembers = dailyStat?.blueCount ?? factionStats?.blue_user_count ?? factionStats?.blue_faction ?? 0;
    const totalMembers = redMembers + blueMembers;
    const redMemberPercent = totalMembers > 0 ? (redMembers / totalMembers) * 100 : 50;
    const blueMemberPercent = 100 - redMemberPercent;

    // Base Area
    const baseRedArea = factionStats?.redArea ?? factionStats?.red_area ?? 0;
    const baseBlueArea = factionStats?.blueArea ?? factionStats?.blue_area ?? 0;
    
    // Apply Bonus Multipliers
    const redBonus = factionStats?.bonus?.RED ?? 0;
    const blueBonus = factionStats?.bonus?.BLUE ?? 0;
    
    const redArea = baseRedArea * (1 + redBonus / 100);
    const blueArea = baseBlueArea * (1 + blueBonus / 100);

    const totalArea = redArea + blueArea;
    const redAreaPercent = totalArea > 0 ? (redArea / totalArea) * 100 : 50;
    const blueAreaPercent = 100 - redAreaPercent;

    const redAreaFormatted = new Intl.NumberFormat('en-US').format(Math.round(redArea || 0));
    const blueAreaFormatted = new Intl.NumberFormat('en-US').format(Math.round(blueArea || 0));

    // Determine which faction the user belongs to for highlighting
    const isRedUser = userFaction?.toLowerCase() === 'red';

    return (
        <div className="mx-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-lg relative">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">阵营战况</h3>
                    <span className="text-[10px] text-foreground/30">本栏目数据每日0点更新</span>
                </div>
                <button className="flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors">
                    详情
                    <ChevronRight className="h-2.5 w-2.5" />
                </button>
            </div>

            {/* Bonus Announcement Banner */}
            {(redBonus > 0 || blueBonus > 0) && (
                <div className={`mb-3 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 px-3 text-xs font-medium backdrop-blur-sm ${redBonus > 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                    <Shield className="w-3.5 h-3.5" />
                    <span>弱势加成生效中：{redBonus > 0 ? `赤焰军领地面积 x${1 + redBonus/100}` : `苍龙营领地面积 x${1 + blueBonus/100}`}</span>
                </div>
            )}

            {/* Section 1: Faction Battle Status (Members) */}
            <div className="mb-4">
                <h4 className="text-xs font-medium text-foreground/50 mb-2">阵营人数</h4>

                {/* Red vs Blue Progress Bar */}
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex mb-2">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${redMemberPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,0.5)] relative"
                    >
                        <div className="absolute top-0 left-0 right-0 h-[40%] bg-white/20" />
                    </motion.div>
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${blueMemberPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                        className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] relative"
                    >
                        <div className="absolute top-0 left-0 right-0 h-[40%] bg-white/20" />
                    </motion.div>
                </div>

                {/* Stats Row */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col items-start">
                        <div className="flex items-center gap-1.5 text-red-500 mb-0.5">
                            <Shield className="w-3.5 h-3.5 fill-current" />
                            <span className="text-lg font-bold leading-none">{redMembers}</span>
                        </div>
                        <span className="text-[10px] text-red-500/60 font-medium">
                            赤焰军 {redMemberPercent.toFixed(1)}%
                            {isRedUser && <span className="ml-1 text-red-400">(我)</span>}
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
                            <span className="text-lg font-bold leading-none">{blueMembers}</span>
                            <Hexagon className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <span className="text-[10px] text-blue-400/60 font-medium">
                            苍龙营 {blueMemberPercent.toFixed(1)}%
                            {!isRedUser && userFaction && <span className="ml-1 text-blue-300">(我)</span>}
                        </span>
                    </div>
                </div>
            </div>

            <div className="h-px bg-white/5 w-full mb-4" />

            {/* Section 2: Territory Power (Area) */}
            <div>
                <h4 className="text-xs font-medium text-foreground/50 mb-2">领地势力</h4>

                {/* Area Progress Bar */}
                <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex mb-2">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${redAreaPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-red-900 to-red-600 relative"
                    />
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${blueAreaPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.1 }}
                        className="h-full bg-gradient-to-l from-blue-900 to-blue-600 relative"
                    />
                </div>

                {/* Stats Row */}
                <div className="flex justify-between items-center">
                    <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1.5 text-red-500/80">
                            <Hexagon className="w-3 h-3" />
                            <span className="text-xs font-medium">{redAreaFormatted}</span>
                        </div>
                        {redBonus > 0 && <span className="text-[9px] text-red-500/50 bg-red-500/10 px-1.5 py-0.5 rounded">原始: {new Intl.NumberFormat('en-US').format(Math.round(baseRedArea))}</span>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 text-blue-400/80">
                            <span className="text-xs font-medium">{blueAreaFormatted}</span>
                            <Hexagon className="w-3 h-3" />
                        </div>
                        {blueBonus > 0 && <span className="text-[9px] text-blue-400/50 bg-blue-500/10 px-1.5 py-0.5 rounded">原始: {new Intl.NumberFormat('en-US').format(Math.round(baseBlueArea))}</span>}
                    </div>
                </div>
            </div>

            {/* Glassmorphism accent */}
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
        </div>
    );
}
