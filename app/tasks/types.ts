// app/tasks/types.ts

import { TaskDto } from '@/app/actions/task';

// --- Display Status ---
// Maps from backend status ('IN_PROGRESS', 'COMPLETED', 'CLAIMED')
export type TaskDisplayStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'CLAIMABLE' | 'CLAIMED';

// --- Difficulty ---
export type TaskDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

// --- Reward ---
export interface TaskReward {
    coins?: number;
    xp?: number;
    diamonds?: number;
    // Add other predictable properties here, like stamina etc.
}

// Extends TaskDto with UI-specific properties that are guaranteed to exist 
// without mutating the underlying data structure unnecessarily.
export interface TaskItem extends TaskDto {
    displayStatus: TaskDisplayStatus;
    difficulty: TaskDifficulty;
    parsedReward: TaskReward;
    originalIndex: number;
}
