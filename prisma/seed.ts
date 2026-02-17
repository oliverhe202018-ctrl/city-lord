import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding tasks...')

    const tasks = [
        // --- Daily Tasks ---
        {
            code: 'daily_morning_run',
            type: 'DAILY',
            title: '晨间巡逻',
            description: '在 06:00-09:00 期间完成一次跑步 (>1km)',
            targetValue: 1,
            unit: 'times',
            reward: { coins: 50, xp: 0 },
            condition: 'RUN_MORNING_CHECK', // Special condition logic
        },
        {
            code: 'daily_capture_grid',
            type: 'DAILY',
            title: '领地扩张',
            description: '解锁或占领一个新的网格',
            targetValue: 1,
            unit: 'grids',
            reward: { coins: 100, xp: 0 },
            condition: 'GRID_CAPTURE_NEW',
        },
        {
            code: 'daily_distance_2km',
            type: 'DAILY',
            title: '轻量热身',
            description: '累计跑步距离达到 2 公里',
            targetValue: 2000,
            unit: 'meters',
            reward: { energy: 10 }, // Energy handled specially? Or just stored in Json
            condition: 'DISTANCE_SUM',
        },
        {
            code: 'daily_checkin_territory',
            type: 'DAILY',
            title: '城主威严',
            description: '访问并点亮自己的一个已占领地',
            targetValue: 1,
            unit: 'times',
            reward: { coins: 30, xp: 0 },
            condition: 'TERRITORY_CHECKIN',
        },

        // --- Weekly Tasks ---
        {
            code: 'weekly_distance_20km',
            type: 'WEEKLY',
            title: '马拉松征程',
            description: '本周累计跑步距离达到 20 公里',
            targetValue: 20000,
            unit: 'meters',
            reward: { chest: 1 }, // Special reward
            condition: 'DISTANCE_SUM',
        },
        {
            code: 'weekly_fast_run',
            type: 'WEEKLY',
            title: '极速突袭',
            description: '单次跑步配速快于 5\'30"/km (且>3km)',
            targetValue: 1,
            unit: 'times',
            reward: { coins: 200, xp: 0 },
            condition: 'RUN_PACE_LIMIT',
        },
        {
            code: 'weekly_capture_10_grids',
            type: 'WEEKLY',
            title: '版图霸主',
            description: '累计占领 10 个不同的网格',
            targetValue: 10,
            unit: 'grids',
            reward: { title_fragment: 1 },
            condition: 'GRID_CAPTURE_COUNT',
        },
        {
            code: 'weekly_active_5_days',
            type: 'WEEKLY',
            title: '坚持不懈',
            description: '本周累计跑步活跃天数达到 5 天',
            targetValue: 5,
            unit: 'days',
            reward: { diamonds: 50 },
            condition: 'ACTIVE_DAYS',
        },
    ]

    for (const t of tasks) {
        await prisma.task.upsert({
            where: { code: t.code },
            update: {
                type: t.type,
                title: t.title,
                description: t.description,
                targetValue: t.targetValue,
                unit: t.unit,
                reward: t.reward,
                condition: t.condition,
            },
            create: {
                code: t.code,
                type: t.type,
                title: t.title,
                description: t.description,
                targetValue: t.targetValue,
                unit: t.unit,
                reward: t.reward,
                condition: t.condition,
            },
        })
    }

    console.log('Seeding completed.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
