import { TaskDto } from '@/app/actions/task';
import { TaskDisplayStatus, TaskReward, TaskDifficulty, TaskItem } from './types';

/**
 * Maps the backend raw status ('IN_PROGRESS' | 'COMPLETED' | 'CLAIMED')
 * to the frontend semantic display status ('NOT_STARTED' | 'IN_PROGRESS' | 'CLAIMABLE' | 'CLAIMED')
 */
export function getTaskDisplayStatus(task: TaskDto): TaskDisplayStatus {
    if (task.status === 'CLAIMED') return 'CLAIMED';
    if (task.status === 'COMPLETED') return 'CLAIMABLE';

    // Status is 'IN_PROGRESS'
    if (task.currentValue === 0) return 'NOT_STARTED';
    return 'IN_PROGRESS';
}

/**
 * Parses raw JSON reward data defensibly.
 * Returns default values if parsing fails or fields are missing.
 */
export function parseTaskReward(rawReward: any): TaskReward {
    try {
        if (!rawReward) return { coins: 0, xp: 0 };

        // If it's already an object, use it safely
        const rewardObj = typeof rawReward === 'string' ? JSON.parse(rawReward) : rawReward;

        return {
            coins: rewardObj.coins || 0,
            xp: rewardObj.xp || 0,
            diamonds: rewardObj.diamonds || 0,
        };
    } catch (error) {
        console.warn('Failed to parse task reward:', rawReward);
        return { coins: 0, xp: 0 };
    }
}

/**
 * Derives the task difficulty.
 * Priority 1: Backend `difficulty` field (if exists).
 * Priority 2: Fallback logic based on target values or type.
 */
export function deriveTaskDifficultyFallback(task: TaskDto): TaskDifficulty {
    // Check if backend added explicit difficulty (future-proofing)
    if ((task as any).difficulty) {
        return (task as any).difficulty as TaskDifficulty;
    }

    // Fallbacks
    if (task.type === 'DISTANCE') {
        if (task.targetValue <= 3000) return 'EASY';      // <= 3km
        if (task.targetValue <= 10000) return 'MEDIUM';  // <= 10km
        return 'HARD';                                  // > 10km
    }

    if (task.type === 'TIME') {
        if (task.targetValue <= 1800) return 'EASY';      // <= 30 mins
        if (task.targetValue <= 3600) return 'MEDIUM';    // <= 60 mins
        return 'HARD';                                  // > 60 mins
    }

    if (task.type === 'AREA') {
        if (task.targetValue <= 500) return 'EASY';
        if (task.targetValue <= 2000) return 'MEDIUM';
        return 'HARD';
    }

    return 'EASY'; // Safe default
}

/**
 * Transforms raw DTOs into extended items with parsed data
 */
export function createDisplayTasks(tasks: (TaskDto & { originalIndex?: number })[]): TaskItem[] {
    return tasks.map((task, index) => ({
        ...task,
        displayStatus: getTaskDisplayStatus(task),
        difficulty: deriveTaskDifficultyFallback(task),
        parsedReward: parseTaskReward(task.reward),
        originalIndex: task.originalIndex !== undefined ? task.originalIndex : index
    }));
}

/**
 * Stably sorts tasks for display:
 * 
 * Priority:
 * 1. CLAIMABLE
 * 2. IN_PROGRESS (Sorted by completion percent DESC)
 * 3. NOT_STARTED
 * 4. CLAIMED
 * 
 * Secondary Keys: Global originalIndex
 */
export function sortTasksForDisplay(tasks: TaskItem[]): TaskItem[] {
    const priorityMap: Record<TaskDisplayStatus, number> = {
        'CLAIMABLE': 1,
        'IN_PROGRESS': 2,
        'NOT_STARTED': 3,
        'CLAIMED': 4
    };

    return [...tasks].sort((a, b) => {
        // 1. Primary Priority
        if (priorityMap[a.displayStatus] !== priorityMap[b.displayStatus]) {
            return priorityMap[a.displayStatus] - priorityMap[b.displayStatus];
        }

        // 2. Tiebreakers within Priority Groups

        // Tiebreaker for IN_PROGRESS: Completion percentage descending
        if (a.displayStatus === 'IN_PROGRESS') {
            if (a.percent !== b.percent) {
                return b.percent - a.percent;
            }
        }

        // Default tiebreaker: maintain stability using originalIndex
        return a.originalIndex - b.originalIndex;
    });
}
