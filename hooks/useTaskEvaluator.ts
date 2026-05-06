
import { useState, useEffect, useMemo } from 'react';
import { DAILY_TASKS, Task } from '@/lib/constants/tasks';
import { RunData, evaluateRunForTask } from '@/lib/game/task-engine';

export function useTaskEvaluator(currentRun: {
    distance: number;
    duration: number;
    claims: any[];
}) {
    // Evaluate tasks whenever run data changes
    const completed = useMemo(() => {
        const runData: RunData = {
            distance: currentRun.distance,
            duration: currentRun.duration,
            claims: currentRun.claims,
            timestamp: new Date()
        };

        return DAILY_TASKS.filter(task => evaluateRunForTask(runData, task));
    }, [currentRun.distance, currentRun.duration, currentRun.claims]);

    return {
        completedTasks: completed,
        hasNewCompletion: false // Reset or implement logic if needed, but for now we follow the fix
    };
}
