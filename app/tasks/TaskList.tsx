'use client';

import React, { useState } from 'react';
import { TaskDto, claimReward } from '@/app/actions/task';
import { toast } from 'sonner'; // Assuming sonner is used based on package.json, or use standard toast
import { Button } from '@/components/ui/button'; // Assuming shadcn/ui
// If button not available, use standard HTML button or check components
// I'll assume basic UI components exist or plain HTML for now if I can't check
import { Loader2, Check, Gift } from 'lucide-react'; // Icons

// Utility function (internal for now)
const formatTaskProgress = (current: number, target: number, unit: string): string => {
    if (unit === 'meters') {
        const currentKm = (current / 1000).toFixed(1);
        const targetKm = (target / 1000).toFixed(1);
        return `${currentKm}/${targetKm} km`;
    }
    return `${current}/${target}`;
};

interface TaskListProps {
    initialTasks: TaskDto[];
    userId: string;
}

export default function TaskList({ initialTasks, userId }: TaskListProps) {
    const [tasks, setTasks] = useState<TaskDto[]>(initialTasks);
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const handleClaim = async (task: TaskDto) => {
        if (task.status !== 'COMPLETED') return;
        setLoadingId(task.progressId);

        try {
            const res = await claimReward(userId, task.progressId);
            if (res.success && res.data) {
                toast.success('领取成功', {
                    description: `获得奖励: ${JSON.stringify(res.data.reward)}`
                });
                // Update local state to reflect change (or reload page)
                setTasks(prev => prev.map(t =>
                    t.progressId === task.progressId ? { ...t, status: 'CLAIMED' } : t
                ));
            } else {
                toast.error('领取失败', { description: res.message });
            }
        } catch (err: any) {
            toast.error('错误', { description: err.message });
        } finally {
            setLoadingId(null);
        }
    };

    const dailyTasks = tasks.filter(t => t.type === 'DAILY');
    const weeklyTasks = tasks.filter(t => t.type === 'WEEKLY');

    const renderTask = (task: TaskDto) => {
        const isCompleted = task.status === 'COMPLETED';
        const isClaimed = task.status === 'CLAIMED';
        const percent = Math.min(100, Math.floor((task.currentValue / task.targetValue) * 100));

        return (
            <div key={task.progressId} className="flex flex-col p-4 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 mb-3">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-semibold text-lg">{task.title}</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{task.description}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                        {/* Reward Badge */}
                        <div className="flex items-center text-amber-500 text-xs font-mono bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
                            <Gift className="w-3 h-3 mr-1" />
                            {JSON.stringify(task.reward)} {/* Simplify display if possible */}
                        </div>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden mb-2">
                    <div
                        className="bg-blue-600 h-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                    />
                </div>

                <div className="flex justify-between items-center mt-1">
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {formatTaskProgress(task.currentValue, task.targetValue, task.unit)}
                    </span>

                    {isClaimed ? (
                        <Button variant="ghost" size="sm" disabled className="text-green-600">
                            <Check className="w-4 h-4 mr-1" /> 已领取
                        </Button>
                    ) : isCompleted ? (
                        <Button
                            size="sm"
                            onClick={() => handleClaim(task)}
                            disabled={loadingId === task.progressId}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            {loadingId === task.progressId && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                            领取奖励
                        </Button>
                    ) : (
                        <Button variant="secondary" size="sm" disabled>
                            进行中
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-md mx-auto p-4 pb-24">
            <h1 className="text-2xl font-bold mb-6">任务中心</h1>

            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-bold mb-3 flex items-center">
                        <span className="w-1 h-6 bg-blue-500 rounded mr-2"></span>
                        每日任务
                    </h2>
                    {dailyTasks.length === 0 ? <p className="text-zinc-500">今日暂无任务</p> : dailyTasks.map(renderTask)}
                </div>

                <div>
                    <h2 className="text-xl font-bold mb-3 flex items-center">
                        <span className="w-1 h-6 bg-purple-500 rounded mr-2"></span>
                        每周挑战
                    </h2>
                    {weeklyTasks.length === 0 ? <p className="text-zinc-500">本周暂无挑战</p> : weeklyTasks.map(renderTask)}
                </div>
            </div>
        </div>
    );
}
