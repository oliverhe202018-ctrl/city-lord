'use client';

import { useState, useCallback, useEffect } from 'react';
import { Loader2, Route } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { modeThemeMap, getAttackHint, useReducedMotion, getStoredMode } from '@/lib/modeTheme';
import type { RunMode, HomeHero } from '@/types/home';

interface HeroStartRunCardProps {
    hero: HomeHero | null;
    isLoading?: boolean;
    onStartRun: (mode: RunMode) => void;
    /** Number of nearby attackable targets (shown on attack pill) */
    nearbyTargetCount?: number;
    /** Navigate to smart planning page */
    onSmartPlan?: () => void;
}

export function HeroStartRunCard({ hero, isLoading, onStartRun, nearbyTargetCount = 0, onSmartPlan }: HeroStartRunCardProps) {
    // Initialize from localStorage → hero default → 'claim'
    const [activeMode, setActiveMode] = useState<RunMode>(() => {
        const stored = getStoredMode();
        if (stored !== 'claim') return stored; // user had a previous preference
        return hero?.modeDefault ?? 'claim';
    });
    const [isStarting, setIsStarting] = useState(false);
    const reducedMotion = useReducedMotion();

    // If hero loads with a default mode and user hasn't changed yet, apply it
    useEffect(() => {
        if (hero?.modeDefault && getStoredMode() === 'claim') {
            setActiveMode(hero.modeDefault);
        }
    }, [hero?.modeDefault]);

    const handleStart = useCallback(() => {
        if (isStarting) return;
        setIsStarting(true);
        // Brief delay for visual feedback, then trigger
        setTimeout(() => {
            onStartRun(activeMode);
            setTimeout(() => setIsStarting(false), 1000);
        }, 300);
    }, [activeMode, isStarting, onStartRun]);

    // Consume theme config — no if/else
    const theme = modeThemeMap[activeMode];

    // Build dynamic subtitle
    const subtitle = hero
        ? hero.cooldownHint
            ? `冷却中：${hero.cooldownHint}`
            : `预计可覆盖 ~${hero.estimatedCoverage} 格 · 今日奖励 ${hero.todayRewardLeft}/${hero.todayRewardTotal}`
        : '正在获取附近目标…';

    // Mode hint: for attack mode, show dynamic count
    const hintText = activeMode === 'attack'
        ? getAttackHint(nearbyTargetCount)
        : theme.hintText;

    return (
        <div className="relative mx-4 rounded-2xl border border-white/10 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-5 backdrop-blur-xl shadow-[0_4px_32px_hsl(var(--primary)/0.15)]">
            <button
                type="button"
                onClick={onSmartPlan}
                className="absolute right-4 top-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/30 bg-white/90 px-2.5 text-[11px] font-semibold text-slate-900 shadow-md transition-all active:scale-95 dark:border-white/20 dark:bg-slate-900/85 dark:text-white"
            >
                <Route className="h-3.5 w-3.5" />
                智能规划
            </button>

            {/* Main CTA Button */}
            <motion.button
                disabled={isStarting}
                onClick={handleStart}
                whileTap={!isStarting && !reducedMotion ? { scale: 0.96 } : {}}
                className={`group relative w-full rounded-2xl py-4 text-center font-black text-lg shadow-[0_6px_24px_hsl(var(--primary)/0.5)] transition-all outline-none focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${onSmartPlan ? 'mt-9' : ''} ${isStarting
                    ? 'bg-primary/50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary to-primary/80 hover:brightness-110 active:brightness-90'
                    }`}
            >
                {/* Pulse rings — suppressed when reduced-motion */}
                {!reducedMotion && (
                    <AnimatePresence>
                        {!isStarting && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden"
                            >
                                <span
                                    className="absolute inset-0 animate-ping rounded-2xl bg-primary/20"
                                    style={{ animationDuration: '2.5s' }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                )}

                <span className="relative z-10 flex items-center justify-center gap-2">
                    {isStarting ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span className="text-primary-foreground">准备中…</span>
                        </>
                    ) : (
                        <span className="text-primary-foreground drop-shadow-md">
                            {theme.ctaEmoji} {theme.ctaText}
                        </span>
                    )}
                </span>
            </motion.button>

            {/* Dynamic subtitle */}
            <p className="mt-2.5 text-center text-xs text-foreground/50">
                {isLoading ? (
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-16 animate-pulse rounded bg-white/10" />
                    </span>
                ) : (
                    subtitle
                )}
            </p>

            {false && (
                <div className="mt-3 flex justify-center" />
            )}

            {/* Mode hint text — consumed from theme config */}
            <p className="mt-2 text-center text-[10px] text-foreground/30">
                {hintText}
            </p>
        </div>
    );
}
