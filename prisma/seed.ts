import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Start seeding missions...')

    const missions = [
        // --- Gamification Tasks (Phase 4) ---
        {
            code: 'daily_treasure_hunt',
            title: '每日寻宝',
            description: '触发随机事件获得宝藏',
            type: 'DAILY',
            target_value: 1,
            reward_xp: 20,
            reward_coins: 50,
        },
        {
            code: 'land_grabber',
            title: '圈地达人',
            description: '单次跑步占领 100 平方米的领地',
            type: 'SINGLE_RUN',
            target_value: 100,
            reward_xp: 50,
            reward_coins: 100,
        },

        // --- Daily Tasks ---
        {
            code: 'daily_morning_run',
            title: '晨间巡逻',
            description: '在 06:00-09:00 期间完成一次跑步 (>1km)',
            type: 'DAILY',
            target_value: 1,
            reward_xp: 0,
            reward_coins: 50,
        },
        {
            code: 'daily_capture_grid',
            title: '领地扩张',
            description: '解锁或占领一个新的网格',
            type: 'DAILY',
            target_value: 1,
            reward_xp: 0,
            reward_coins: 100,
        },
        {
            code: 'daily_distance_2km',
            title: '轻量热身',
            description: '累计跑步距离达到 2 公里',
            type: 'DAILY',
            target_value: 2000,
            reward_xp: 0,
            reward_coins: 0,
        },
        {
            code: 'daily_checkin_territory',
            title: '城主威严',
            description: '访问并点亮自己的一个已占领地',
            type: 'DAILY',
            target_value: 1,
            reward_xp: 0,
            reward_coins: 30,
        },

        // --- Weekly Tasks ---
        {
            code: 'weekly_distance_20km',
            title: '马拉松征程',
            description: '本周累计跑步距离达到 20 公里',
            type: 'WEEKLY',
            target_value: 20000,
            reward_xp: 0,
            reward_coins: 0,
        },
        {
            code: 'weekly_fast_run',
            title: '极速突袭',
            description: '单次跑步配速快于 5\'30"/km (且>3km)',
            type: 'WEEKLY',
            target_value: 1,
            reward_xp: 0,
            reward_coins: 200,
        },
        {
            code: 'weekly_capture_10_grids',
            title: '版图霸主',
            description: '累计占领 10 个不同的网格',
            type: 'WEEKLY',
            target_value: 10,
            reward_xp: 0,
            reward_coins: 0,
        },
        {
            code: 'weekly_active_5_days',
            title: '坚持不懈',
            description: '本周累计跑步活跃天数达到 5 天',
            type: 'WEEKLY',
            target_value: 5,
            reward_xp: 0,
            reward_coins: 0,
        },
    ]

    for (const m of missions) {
        await prisma.missions.upsert({
            where: { id: m.code },
            update: {
                title: m.title,
                description: m.description,
                type: m.type,
                target_value: m.target_value,
                reward_xp: m.reward_xp,
                reward_coins: m.reward_coins,
            },
            create: {
                id: m.code,
                title: m.title,
                description: m.description,
                type: m.type,
                target_value: m.target_value,
                reward_xp: m.reward_xp,
                reward_coins: m.reward_coins,
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
