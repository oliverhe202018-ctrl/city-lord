'use client';

import React from 'react';

interface TaskProgressProps {
    current: number;
    target: number;
    unit: string;
    percent: number;
}

export function TaskProgress({ current, target, unit, percent }: TaskProgressProps) {
    // Format Display
    let displayString = '';

    if (unit === 'meters' || unit === 'm') {
        const currentKm = (current / 1000).toFixed(1);
        const targetKm = (target / 1000).toFixed(1);
        displayString = `${currentKm}/${targetKm} km`;
    } else {
        displayString = `${current}/${target}`;
    }

    // Ensure percent visually bounds between 0 and 100
    const boundedPercent = Math.max(0, Math.min(100, percent));

    return (
        <div className="flex flex-col mb-1 w-full">
            {/* Progress Bar Container */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-2 relative">
                <div
                    className="bg-purple-600 dark:bg-purple-500 h-full transition-all duration-500 ease-out absolute left-0 top-0 bottom-0"
                    style={{ width: `${boundedPercent}%` }}
                />
            </div>
            {/* Numeric Display */}
            <div className="flex justify-between items-center text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <span>当前进度</span>
                <span>{displayString}</span>
            </div>
        </div>
    );
}
