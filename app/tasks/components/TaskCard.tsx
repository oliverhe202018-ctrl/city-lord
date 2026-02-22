'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { TaskItem } from '../types';
import { TaskRewardTag } from './TaskRewardTag';
import { TaskProgress } from './TaskProgress';

interface TaskCardProps {
    task: TaskItem;
    isClaiming: boolean;
    isError?: boolean;
    onClaim: (task: TaskItem) => void;
}

export function TaskCard({ task, isClaiming, isError = false, onClaim }: TaskCardProps) {
    const {
        title,
        description,
        displayStatus,
        difficulty,
        parsedReward,
        currentValue,
        targetValue,
        unit,
        percent
    } = task;

    const getDifficultyColor = () => {
        switch (difficulty) {
            case 'HARD': return 'text-red-500 bg-red-50 dark:bg-red-950/30';
            case 'MEDIUM': return 'text-orange-500 bg-orange-50 dark:bg-orange-950/30';
            default: return 'text-green-500 bg-green-50 dark:bg-green-950/30';
        }
    };

    const getDifficultyLabel = () => {
        switch (difficulty) {
            case 'HARD': return '高难';
            case 'MEDIUM': return '中级';
            default: return '初级';
        }
    }

    return (
        <div className="flex flex-col p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 mb-4 transition-all hover:border-purple-300 dark:hover:border-purple-700/50">
            {/* Header: Title, tags */}
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${getDifficultyColor()}`}>
                            {getDifficultyLabel()}
                        </span>
                    </div>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-1">{description}</p>
                </div>

                {/* Reward Badge */}
                <TaskRewardTag reward={parsedReward} />
            </div>

            {/* Progress Body */}
            <div className="mt-2 mb-3">
                <TaskProgress
                    current={currentValue}
                    target={targetValue}
                    unit={unit}
                    percent={percent}
                />
            </div>

            {/* Card Footer: Status or Action Button */}
            <div className="flex justify-between items-end mt-1">
                {/* UI Status text mapping for clarity if needed, or simply empty flex spacer */}
                <div className="text-xs font-semibold text-zinc-400">
                    {displayStatus === 'NOT_STARTED' && '未开始'}
                    {displayStatus === 'IN_PROGRESS' && '进行中'}
                </div>

                <div className="flex items-center">
                    {displayStatus === 'CLAIMED' ? (
                        <Button variant="ghost" size="sm" disabled className="text-green-600 dark:text-green-500 opacity-60">
                            <Check className="w-4 h-4 mr-1" /> 奖励已发
                        </Button>
                    ) : displayStatus === 'CLAIMABLE' ? (
                        <Button
                            size="sm"
                            onClick={() => onClaim(task)}
                            disabled={isClaiming}
                            className={`transition-all duration-300 ${isClaiming
                                ? 'bg-zinc-400 text-white cursor-not-allowed'
                                : isError
                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20 hover:-translate-y-0.5'
                                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-600/20 hover:shadow-lg hover:shadow-purple-600/40 hover:-translate-y-0.5'
                                }`}
                        >
                            {isClaiming && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {isClaiming ? '领取中...' : isError ? '重试领取' : '领取奖励'}
                        </Button>
                    ) : (
                        // Not started / In progress fallback
                        <Button variant="secondary" size="sm" disabled className="opacity-50">
                            未达成
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
