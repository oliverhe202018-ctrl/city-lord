'use client';

import { useMemo } from 'react';
import { ChevronRight, Sword } from 'lucide-react';
import { useGameStore } from '@/store/useGameStore';
import { motion } from 'framer-motion';

interface FactionData {
    name: string;
    color: string;
    secondaryColor: string;
    percentage: number;
    count: number;
}

const MOCK_FACTIONS: FactionData[] = [
    { name: '破晓者', color: '#f97316', secondaryColor: '#ea580c', percentage: 35, count: 12543 },
    { name: '守望者', color: '#22c55e', secondaryColor: '#16a34a', percentage: 25, count: 8932 },
    { name: '秘术师', color: '#a855f7', secondaryColor: '#9333ea', percentage: 40, count: 14321 },
];

export function FactionBattleStatusCard() {
    const userFaction = useGameStore(state => state.faction);

    // In a real app, this would come from an API
    const cityFactionData = MOCK_FACTIONS;

    // Calculate segments for the circular chart
    const chartSegments = useMemo(() => {
        let cumulativePercentage = 0;
        return cityFactionData.map((faction) => {
            const startAngle = (cumulativePercentage / 100) * 360;
            cumulativePercentage += faction.percentage;
            const endAngle = (cumulativePercentage / 100) * 360;
            
            // Convert polar to Cartesian for SVG path
            const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
                const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
                return {
                    x: centerX + (radius * Math.cos(angleInRadians)),
                    y: centerY + (radius * Math.sin(angleInRadians))
                };
            };

            const start = polarToCartesian(50, 50, 40, endAngle);
            const end = polarToCartesian(50, 50, 40, startAngle);
            const largeArcFlag = faction.percentage > 50 ? "1" : "0";

            return {
                ...faction,
                pathData: [
                    "M", start.x, start.y, 
                    "A", 40, 40, 0, largeArcFlag, 0, end.x, end.y
                ].join(" ")
            };
        });
    }, [cityFactionData]);

    return (
        <div className="mx-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md shadow-lg">
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

            <div className="flex items-center gap-6">
                {/* Left: Territory Ratio Chart */}
                <div className="relative flex flex-col items-center flex-shrink-0">
                    <div className="relative h-24 w-24">
                        <svg viewBox="0 0 100 100" className="h-full w-full rotate-0 transform">
                            {/* Background Circle */}
                            <circle cx="50" cy="50" r="40" fill="transparent" stroke="white" strokeWidth="8" strokeOpacity="0.05" />
                            
                            {/* Faction Segments */}
                            {chartSegments.map((segment, i) => (
                                <motion.path
                                    key={segment.name}
                                    d={segment.pathData}
                                    fill="transparent"
                                    stroke={segment.color}
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 0.8, delay: i * 0.2 }}
                                    style={{
                                        filter: `drop-shadow(0 0 4px ${segment.color}40)`
                                    }}
                                />
                            ))}
                        </svg>
                        
                        {/* Center Icon/Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <Sword className="h-4 w-4 text-foreground/40 mb-0.5" />
                            <span className="text-[10px] font-bold text-foreground/60 leading-tight">642k</span>
                        </div>
                    </div>
                    <span className="mt-2 text-[10px] font-medium text-foreground/40">领地占领比</span>
                </div>

                {/* Right: Faction List */}
                <div className="flex flex-1 flex-col gap-3">
                    {cityFactionData.map((faction, i) => {
                        const isMyFaction = faction.name === userFaction || (userFaction === 'Red' && faction.name === '破晓者') || (userFaction === 'Blue' && faction.name === '秘术师');
                        // Handle potential translation or mapping
                        const displayName = isMyFaction ? `${faction.name}(我的阵营)` : faction.name;

                        return (
                            <div key={faction.name} className="flex flex-col gap-0.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <div 
                                            className="h-2 w-2 rounded-full" 
                                            style={{ backgroundColor: faction.color, boxShadow: `0 0 6px ${faction.color}80` }} 
                                        />
                                        <span className={`text-xs ${isMyFaction ? 'font-bold text-foreground' : 'font-medium text-foreground/70'}`}>
                                            {displayName}
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-foreground/90 tabular-nums">
                                        {faction.percentage}%
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pl-3.5">
                                    <span className="text-[10px] text-foreground/30">
                                        领地数: {faction.count.toLocaleString()}
                                    </span>
                                    {isMyFaction && (
                                        <div className="h-0.5 w-full mx-2 rounded-full bg-white/5 overflow-hidden">
                                            <motion.div 
                                                className="h-full bg-foreground/10" 
                                                initial={{ width: 0 }}
                                                animate={{ width: '100%' }}
                                                transition={{ duration: 1, delay: 0.5 }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            {/* Glassmorphism accent */}
            <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
        </div>
    );
}
