
import { DAILY_TASKS, WEEKLY_CHALLENGES, Task, TaskType } from '@/lib/constants/tasks';

export interface RunData {
    distance: number; // meters
    duration: number; // seconds
    claims: any[]; // Array of claimed polygons
    timestamp: Date;
}

export interface TaskResult {
    taskId: string;
    completed: boolean;
    progress: number;
    periodKey: string;
    reward: number;
    type: 'DAILY' | 'WEEKLY' | 'ACHIEVEMENT';
}

/**
 * Generates the period key for a task based on its type and category.
 * Daily: "YYYY-MM-DD"
 * Weekly: "YYYY-Www"
 */
export function getPeriodKey(category: 'daily' | 'weekly', date: Date = new Date()): string {
    if (category === 'daily') {
        // YYYY-MM-DD
        return date.toISOString().split('T')[0];
    } else {
        // YYYY-Www
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
    }
}

/**
 * Checks if a run meets the criteria for a specific task.
 * Note: This checks SINGLE RUN performance or triggers accumulator logic.
 * For cumulative tasks (Weekly), we might need DB aggregation, but for now 
 * we assume the 'progress' is passed in or we are checking if THIS run *contributes* 
 * and let the DB transaction handle validity.
 * 
 * However, the prompt implies strict checking. 
 * 'Morning Patrol' -> Time check.
 * 'Flag Planting' -> Loop count > 0.
 */
export function evaluateRunForTask(run: RunData, task: Task): boolean {
    switch (task.id) {
        // --- Daily Tasks ---
        case 'morning_patrol':
            // 6:00 - 9:00 AM
            const hour = run.timestamp.getHours();
            const isMorning = hour >= 6 && hour < 9;
            return isMorning && run.distance >= task.targetValue;

        case 'territory_expansion':
            // 500m² in this run (Simplified: Logic might need accumulation)
            // calculating total area of claims in this session
            const totalArea = run.claims.reduce((acc, c) => acc + (c.area || 0), 0);
            return totalArea >= task.targetValue;

        case 'flag_planting':
            // 1 loop
            return run.claims.length >= task.targetValue;

        case 'quick_sprint':
            // 15 min duration
            return run.duration >= task.targetValue;

        // --- Weekly Challenges (Usually cumulative, but handled here as single-trigger for now implies logic needs to be robust) ---
        // For simple "Simulate" per prompt, we just return true if threshold met in *this* run
        // Real implementation would need to query DB for "current weekly total".
        // Given constraints, we will focus on the DAILY ones which are session-based or time-based.
        // Weekly logic is complex without aggregation. We will stub strictly session-based checks.

        default:
            return false;
    }
}

export function evaluateTasks(runData: RunData): TaskResult[] {
    const results: TaskResult[] = [];
    const date = runData.timestamp;

    // Check Daily Tasks
    DAILY_TASKS.forEach(task => {
        if (evaluateRunForTask(runData, task)) {
            results.push({
                taskId: task.id,
                completed: true,
                progress: task.targetValue,
                periodKey: getPeriodKey('daily', date),
                reward: task.reward,
                type: 'DAILY'
            });
        }
    });

    // Check Weekly Tasks (Only single-session achievable ones or distinct events)
    // 'endurance_warrior' is single run 60 min
    WEEKLY_CHALLENGES.forEach(task => {
        if (task.id === 'endurance_warrior' && runData.duration >= task.targetValue) {
            results.push({
                taskId: task.id,
                completed: true,
                progress: runData.duration,
                periodKey: getPeriodKey('weekly', date),
                reward: task.reward,
                type: 'WEEKLY'
            });
        }
        // Others require aggregation (total distance/area). 
        // We will skip them in this specific "single run evaluation" function 
        // unless we fetch previous stats. 
        // For this immediate task, we focus on what can be locally evaluated.
    });

    return results;
}
