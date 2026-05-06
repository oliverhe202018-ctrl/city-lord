/**
 * Game Task System Configuration
 * 
 * Defines Daily Tasks and Weekly Challenges for the running game.
 */

export type TaskType = 'DISTANCE' | 'AREA' | 'LOOP_COUNT' | 'TIME';

export interface Task {
    id: string;
    title: string;
    description: string;
    targetValue: number; // Unit depends on type: meters, m², count, seconds
    reward: number; // XP or coin reward
    type: TaskType;
}

export interface DailyTask extends Task {
    category: 'daily';
}

export interface WeeklyChallenge extends Task {
    category: 'weekly';
}

/**
 * Daily Tasks (Resets every 24h)
 */
export const DAILY_TASKS: DailyTask[] = [
    {
        id: 'morning_patrol',
        title: '晨间巡逻',
        description: '在早晨 6:00-9:00 完成 2km 跑步',
        targetValue: 2000, // 2000 meters
        reward: 50,
        type: 'DISTANCE',
        category: 'daily'
    },
    {
        id: 'territory_expansion',
        title: '领地扩张',
        description: '占领至少 500m² 的新领地',
        targetValue: 500, // 500 m²
        reward: 80,
        type: 'AREA',
        category: 'daily'
    },
    {
        id: 'flag_planting',
        title: '插旗行动',
        description: '完成 1 次完整的领地闭环',
        targetValue: 1, // 1 loop
        reward: 60,
        type: 'LOOP_COUNT',
        category: 'daily'
    },
    {
        id: 'quick_sprint',
        title: '快速冲刺',
        description: '单次跑步坚持 15 分钟以上',
        targetValue: 900, // 900 seconds (15 min)
        reward: 40,
        type: 'TIME',
        category: 'daily'
    }
];

/**
 * Weekly Challenges (Resets every Monday 00:00)
 */
export const WEEKLY_CHALLENGES: WeeklyChallenge[] = [
    {
        id: 'marathon_week',
        title: '马拉松周',
        description: '本周累计跑步 20km',
        targetValue: 20000, // 20,000 meters
        reward: 300,
        type: 'DISTANCE',
        category: 'weekly'
    },
    {
        id: 'empire_builder',
        title: '帝国建设者',
        description: '本周累计占领 5000m² 领地',
        targetValue: 5000, // 5000 m²
        reward: 500,
        type: 'AREA',
        category: 'weekly'
    },
    {
        id: 'loop_master',
        title: '闭环大师',
        description: '本周完成 10 次领地闭环',
        targetValue: 10, // 10 loops
        reward: 400,
        type: 'LOOP_COUNT',
        category: 'weekly'
    },
    {
        id: 'endurance_warrior',
        title: '耐力战士',
        description: '单次跑步坚持 60 分钟以上',
        targetValue: 3600, // 3600 seconds (60 min)
        reward: 600,
        type: 'TIME',
        category: 'weekly'
    }
];
