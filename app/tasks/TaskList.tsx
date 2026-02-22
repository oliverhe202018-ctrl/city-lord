'use client';

import React, { useState, useMemo } from 'react';
import { TaskDto, claimReward } from '@/app/actions/task';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { createDisplayTasks, sortTasksForDisplay } from './utils';
import { TaskItem } from './types';
import { TaskCard } from './components/TaskCard';
import { goToMapPage, goToRunPage } from './navigation';

interface TaskListProps {
    initialTasks: TaskDto[];
    userId: string;
}

type TabType = 'ALL' | 'DAILY' | 'WEEKLY';

export default function TaskList({ initialTasks, userId }: TaskListProps) {
    const [tasks, setTasks] = useState<(TaskDto & { originalIndex: number })[]>(() =>
        initialTasks.map((t, i) => ({ ...t, originalIndex: i }))
    );
    const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
    const [failedClaimTaskIds, setFailedClaimTaskIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<TabType>('ALL');

    // 1. Data Transformation Pipeline
    const displayTasks = useMemo(() => {
        const extendedTasks = createDisplayTasks(tasks);

        // Filter by Tab
        const filteredTasks = extendedTasks.filter(t => {
            if (activeTab === 'DAILY') return t.type === 'DAILY';
            if (activeTab === 'WEEKLY') return t.type === 'WEEKLY';
            return true; // ALL
        });

        // Sort reliably
        return sortTasksForDisplay(filteredTasks);
    }, [tasks, activeTab]);

    // 2. Action Handlers
    const handleClaim = async (task: TaskItem) => {
        if (task.displayStatus !== 'CLAIMABLE') return;

        setClaimingTaskId(task.id);
        // Clear previous error state for this specific task
        setFailedClaimTaskIds(prev => {
            const next = new Set(prev);
            next.delete(task.id);
            return next;
        });

        try {
            const res = await claimReward(userId, task.progressId);
            if (res.success && res.data) {
                toast.success('领取成功', {
                    description: '奖励已放入您的钱包',
                    duration: 3000
                });

                // Update local state reliably without refetching immediately
                setTasks(prev => prev.map(t =>
                    t.progressId === task.progressId ? { ...t, status: 'CLAIMED' } : t
                ));
            } else {
                setFailedClaimTaskIds(prev => new Set(prev).add(task.id));
                toast.error('领取失败', { description: res.message || '网络或接口错误' });
            }
        } catch (err: any) {
            setFailedClaimTaskIds(prev => new Set(prev).add(task.id));
            toast.error('请求出错了', { description: err.message || '请稍后重试' });
        } finally {
            setClaimingTaskId(null);
        }
    };

    // 3. Render Helpers
    const renderEmptyState = () => {
        if (activeTab === 'DAILY') {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3">
                        <span className="text-2xl text-blue-500">🏃</span>
                    </div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">今日跑量已达标！</h3>
                    <p className="text-xs text-zinc-500 mb-4 max-w-[200px]">您的坚持令人赞叹！快去地图上留下更多专属足迹，解锁隐藏彩蛋吧~</p>
                    <Button variant="outline" size="sm" onClick={goToRunPage}>
                        继续探索领地
                    </Button>
                </div>
            );
        }

        if (activeTab === 'WEEKLY') {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center">
                    <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mb-3">
                        <span className="text-2xl text-purple-500">🏆</span>
                    </div>
                    <h3 className="font-bold text-zinc-900 dark:text-zinc-100 mb-1">本周挑战已全部征服</h3>
                    <p className="text-xs text-zinc-500 mb-4 max-w-[200px]">您已展现出非凡的实力！不妨随意跑跑保持状态，下周将刷新全新挑战。</p>
                    <Button variant="outline" size="sm" onClick={goToMapPage}>
                        进入地图发现
                    </Button>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center p-10 py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                    <span className="text-2xl text-zinc-400">📝</span>
                </div>
                <h3 className="text-zinc-500 font-medium mb-1">暂时没有可用任务</h3>
                <p className="text-xs text-zinc-400">请稍后再来看看，或前往地图跑动触发</p>
            </div>
        );
    };

    return (
        <div className="max-w-md mx-auto p-4 pb-24">
            <h1 className="text-2xl font-bold mb-6 select-none tracking-tight">任务中心</h1>

            {/* Sticky Tabs */}
            <div className="sticky flex space-x-2 bg-zinc-50/80 dark:bg-black/50 backdrop-blur-md p-1 rounded-xl mb-6 z-10 top-0 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'ALL'
                        ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-white'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                >
                    全部
                </button>
                <button
                    onClick={() => setActiveTab('DAILY')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'DAILY'
                        ? 'bg-blue-50 dark:bg-blue-900/30 shadow text-blue-700 dark:text-blue-300'
                        : 'text-zinc-500 hover:text-blue-600/60 dark:hover:text-blue-400/60'
                        }`}
                >
                    每日任务
                </button>
                <button
                    onClick={() => setActiveTab('WEEKLY')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'WEEKLY'
                        ? 'bg-purple-50 dark:bg-purple-900/30 shadow text-purple-700 dark:text-purple-300'
                        : 'text-zinc-500 hover:text-purple-600/60 dark:hover:text-purple-400/60'
                        }`}
                >
                    每周挑战
                </button>
            </div>

            {/* Task List Render */}
            <div className="space-y-4">
                {displayTasks.length === 0 ? (
                    renderEmptyState()
                ) : (
                    <div className="flex flex-col gap-1">
                        {/* PERFORMANCE NOTE: For very large lists, consider implementing a virtualized list (e.g., using @tanstack/react-virtual) 
                            or cursor-based pagination 'Load More' to prevent DOM bottlenecks. */}
                        {displayTasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                isClaiming={claimingTaskId === task.id}
                                isError={failedClaimTaskIds.has(task.id)}
                                onClaim={handleClaim}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
