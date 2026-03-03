'use client';

import { useState, useEffect } from 'react';
import { modeThemeMap, getStoredMode } from '@/lib/modeTheme';
import type { RunMode } from '@/types/home';

const loadingMessages = [
    '正在定位您的位置…',
    '正在计算附近的目标…',
    '正在加载战况数据…',
    '即将准备就绪…',
];

/**
 * Full-page skeleton for GameHomePage.
 * The Hero CTA button is rendered as clickable even during skeleton state.
 * Loading messages cycle through to give a sense of progress.
 * Default mode reads from localStorage for instant display.
 */
export function HomeSkeleton({ onStartRun }: { onStartRun?: (mode: RunMode) => void }) {
    const [msgIndex, setMsgIndex] = useState(0);
    const [showToast, setShowToast] = useState(false);

    // Read from localStorage for instant CTA text
    const defaultMode = getStoredMode();
    const theme = modeThemeMap[defaultMode];

    // Cycle through loading messages
    useEffect(() => {
        const interval = setInterval(() => {
            setMsgIndex((prev) => Math.min(prev + 1, loadingMessages.length - 1));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleEarlyStart = () => {
        if (onStartRun) {
            setShowToast(true);
            // Immediately trigger run — no delay
            onStartRun(defaultMode);
            setTimeout(() => setShowToast(false), 3000);
        }
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#0f172a] relative">
            {/* Toast for early click */}
            {showToast && (
                <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-primary/90 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    附近目标计算中，不影响{theme.ctaText}
                </div>
            )}

            {/* Top bar skeleton */}
            <div className="flex items-center justify-between px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-12 rounded bg-white/10 animate-pulse" />
                <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
            </div>

            {/* Hero CTA — clickable even during skeleton */}
            <div className="mx-4 mt-2 rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
                <button
                    onClick={handleEarlyStart}
                    className="w-full rounded-2xl bg-gradient-to-r from-primary to-primary/80 py-4 text-lg font-black text-primary-foreground shadow-[0_6px_24px_hsl(var(--primary)/0.5)] transition-all hover:brightness-110 active:scale-[0.97]"
                >
                    {theme.ctaEmoji} {theme.ctaText}
                </button>
                <p className="mt-2.5 text-center text-xs text-foreground/40 transition-all duration-300">
                    {loadingMessages[msgIndex]}
                </p>

                {/* Progress dots */}
                <div className="mt-2 flex justify-center gap-1">
                    {loadingMessages.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-500 ${i <= msgIndex
                                ? 'w-3 bg-primary/60'
                                : 'w-1 bg-white/10'
                                }`}
                        />
                    ))}
                </div>

                <div className="mt-3 flex justify-center">
                    <div className="h-8 w-48 rounded-full bg-white/5 animate-pulse" />
                </div>
            </div>

            {/* Sections skeleton */}
            <div className="mt-5 px-4 space-y-5">
                {/* Targets skeleton */}
                <div>
                    <div className="h-4 w-28 rounded bg-white/10 animate-pulse mb-2" />
                    <div className="flex gap-3 overflow-hidden">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex-shrink-0 w-[240px] h-[130px] rounded-xl border border-white/5 bg-white/3 animate-pulse"
                                style={{ animationDelay: `${i * 150}ms` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Battle feed skeleton */}
                <div>
                    <div className="h-4 w-36 rounded bg-white/10 animate-pulse mb-2" />
                    <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-14 rounded-xl bg-white/3 animate-pulse"
                                style={{ animationDelay: `${i * 100}ms` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Progress skeleton */}
                <div>
                    <div className="h-4 w-20 rounded bg-white/10 animate-pulse mb-2" />
                    <div className="h-24 rounded-xl bg-white/3 animate-pulse" />
                </div>

                {/* Leaderboard skeleton */}
                <div className="pb-24">
                    <div className="h-8 w-40 rounded bg-white/10 animate-pulse mb-2" />
                    <div className="h-32 rounded-xl bg-white/3 animate-pulse" />
                </div>
            </div>
        </div>
    );
}
