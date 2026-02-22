'use client';

import React from 'react';
import { Gift } from 'lucide-react';
import { TaskReward } from '../types';

interface TaskRewardTagProps {
    reward: TaskReward;
    className?: string; // Optional custom string classes
}

export function TaskRewardTag({ reward, className = '' }: TaskRewardTagProps) {
    if (!reward) return null;

    // Build the string representation.
    const parts = [];
    if (reward.coins && reward.coins > 0) parts.push(`${reward.coins} 金币`);
    if (reward.xp && reward.xp > 0) parts.push(`${reward.xp} 经验`);
    if (reward.diamonds && reward.diamonds > 0) parts.push(`${reward.diamonds} 钻石`);

    // If perfectly empty but reward objects exist, or we have raw fallback strings.
    const displayString = parts.length > 0
        ? parts.join(' | ')
        : '完成奖励'; // Minimal fallback

    return (
        <div className={`flex items-center text-amber-500 text-xs font-mono bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded ${className}`}>
            <Gift className="w-3 h-3 mr-1" />
            <span className="font-semibold">{displayString}</span>
        </div>
    );
}
