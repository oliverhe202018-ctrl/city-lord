'use client';

import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';
import { modeThemeMap, useReducedMotion } from '@/lib/modeTheme';
import type { RunMode } from '@/types/home';

interface ModeTogglePillsProps {
    activeMode: RunMode;
    onModeChange: (mode: RunMode) => void;
    /** Optional: count of nearby attack targets (shown on attack pill) */
    attackTargetCount?: number;
    /** Navigate to smart planning page */
    onSmartPlan?: () => void;
}

const modeKeys: RunMode[] = ['claim', 'defend', 'attack'];

export function ModeTogglePills({ activeMode, onModeChange, attackTargetCount, onSmartPlan }: ModeTogglePillsProps) {
    const reducedMotion = useReducedMotion();

    return (
        <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full bg-white/5 p-1 backdrop-blur-md border border-white/10">
                {modeKeys.map((modeId) => {
                    const cfg = modeThemeMap[modeId];
                    const isActive = activeMode === modeId;
                    const Icon = cfg.Icon;

                    return (
                        <button
                            key={modeId}
                            onClick={() => onModeChange(modeId)}
                            className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${isActive
                                ? `${cfg.colorClass}`
                                : 'text-slate-600 dark:text-white/40 hover:text-slate-900 dark:hover:text-white/65'
                                }`}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="modePillBg"
                                    className={`absolute inset-0 rounded-full ${cfg.bgClass} border ${cfg.borderClass} ${reducedMotion ? '' : cfg.glowClass}`}
                                    transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                            <Icon className={`relative z-10 h-3.5 w-3.5 transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`} />
                            <span className="relative z-10">{cfg.label}</span>

                            {/* Attack mode: show target count badge */}
                            {modeId === 'attack' && typeof attackTargetCount === 'number' && attackTargetCount > 0 && (
                                <span className="relative z-10 ml-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500/80 px-1 text-[9px] font-bold text-white">
                                    {attackTargetCount > 9 ? '9+' : attackTargetCount}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Smart Planning button */}
            {onSmartPlan && (
                <button
                    onClick={onSmartPlan}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-500/20 border border-cyan-400/40 backdrop-blur-md transition-all duration-200 hover:bg-cyan-500/30 hover:border-cyan-400/60 active:scale-95 shadow-[0_0_10px_hsl(185,70%,50%,0.2)]"
                >
                    <Brain className="h-3.5 w-3.5" />
                    <span>智能规划</span>
                </button>
            )}
        </div>
    );
}
