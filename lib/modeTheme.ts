'use client';

import { Flag, Shield, Swords } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RunMode } from '@/types/home';

// ─── Shared Mode Theme Config ───────────────────────────────────────────────

export interface ModeTheme {
    label: string;           // pill label: 占地 / 守地 / 抢夺
    Icon: LucideIcon;
    colorClass: string;      // text color when active
    bgClass: string;         // active pill background
    borderClass: string;     // active pill border
    glowClass: string;       // glow shadow (disabled when reduced-motion)
    ctaEmoji: string;        // emoji prefix on CTA button
    ctaText: string;         // CTA button text
    hintText: string;        // explanation below mode pills
}

export const modeThemeMap: Record<RunMode, ModeTheme> = {
    claim: {
        label: '圈地',
        Icon: Flag,
        colorClass: 'text-violet-700 dark:text-violet-300',
        bgClass: 'bg-violet-100 dark:bg-violet-500/30',
        borderClass: 'border-violet-300 dark:border-violet-400/50',
        glowClass: 'shadow-[0_0_12px_hsl(270,70%,55%,0.3)]',
        ctaEmoji: '🏃',
        ctaText: '开始圈地跑',
        hintText: '跑步即占领附近未拥有的地块',
    },
    defend: {
        label: '巡逻',
        Icon: Shield,
        colorClass: 'text-emerald-700 dark:text-emerald-300',
        bgClass: 'bg-emerald-100 dark:bg-emerald-500/25',
        borderClass: 'border-emerald-300 dark:border-emerald-400/50',
        glowClass: 'shadow-[0_0_12px_hsl(155,60%,45%,0.3)]',
        ctaEmoji: '🛡️',
        ctaText: '开始巡逻跑',
        hintText: '巡逻增强已有地块的防守，提高收益',
    },
    attack: {
        label: '突袭',
        Icon: Swords,
        colorClass: 'text-rose-700 dark:text-rose-300',
        bgClass: 'bg-rose-100 dark:bg-rose-500/25',
        borderClass: 'border-rose-300 dark:border-rose-400/50',
        glowClass: 'shadow-[0_0_12px_hsl(350,65%,50%,0.3)]',
        ctaEmoji: '⚔️',
        ctaText: '出发突袭目标',
        hintText: '针对附近目标发起突袭',
    },
};

/**
 * Returns the attack-mode hint with dynamic target count.
 */
export function getAttackHint(count: number): string {
    return count > 0
        ? `附近有 ${count} 个可抢夺目标`
        : modeThemeMap.attack.hintText;
}

// ─── Reduced Motion ─────────────────────────────────────────────────────────

/**
 * Respects user's prefers-reduced-motion OS setting.
 * When true, pulse / glow / spring animations should be suppressed.
 */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mql.matches);
        const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    return reduced;
}

// ─── LocalStorage helpers ───────────────────────────────────────────────────

const LS_KEY = 'cl_last_mode';

export function getStoredMode(): RunMode {
    if (typeof window === 'undefined') return 'claim';
    const stored = localStorage.getItem(LS_KEY);
    if (stored === 'claim' || stored === 'defend' || stored === 'attack') return stored;
    return 'claim';
}

export function setStoredMode(mode: RunMode): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KEY, mode);
    }
}
