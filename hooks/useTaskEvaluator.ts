
import { useState, useEffect, useMemo } from 'react';
import { DAILY_TASKS, Task } from '@/lib/constants/tasks';
import { RunData, evaluateRunForTask } from '@/lib/game/task-engine';

export function useTaskEvaluator(currentRun: {
    distance: number;
    duration: number;
    claims: any[];
}) {
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);

    // Evaluate tasks whenever run data changes
    // Debounce could be added if performance is an issue, but standard runs update 1hz which is fine
    const completed = useMemo(() => {
        const runData: RunData = {
            distance: currentRun.distance,
            duration: currentRun.duration,
            claims: currentRun.claims,
            timestamp: new Date()
        };

        return DAILY_TASKS.filter(task => evaluateRunForTask(runData, task));
    }, [currentRun.distance, currentRun.duration, currentRun.claims.length]);

    return {
        completedTasks: completed,
        hasNewCompletion: completed.length > completedTasks.length
    };
}
