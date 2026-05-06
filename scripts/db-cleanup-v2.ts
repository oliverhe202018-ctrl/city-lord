import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- City Lord: 脏数据清理脚本 (Dirty Data Cleanup) ---');
    console.log('[1/6] 清空所有领地主表及关联事件...');
    
    // 使用事务保证原子性
    await prisma.$transaction([
        // 清理领地主表
        prisma.territories.deleteMany({}),
        // 清理领地相关日志/事件 (防止外键约束或残留)
        prisma.territory_events.deleteMany({}),
        prisma.territory_hp_logs.deleteMany({}),
        prisma.territory_owner_change_logs.deleteMany({}),
    ]);
    console.log('✅ 领地表已清空');

    console.log('[2/6] 重置用户城市进度 (user_city_progress)...');
    await prisma.user_city_progress.updateMany({
        data: {
            experience: 0,
            tiles_captured: 0,
            area_controlled: 0,
            score: 0
        }
    });
    console.log('✅ 城市进度已重置');

    console.log('[3/6] 重置阵营面积统计 (faction_stats)...');
    // 清理缓存和快照
    await prisma.factionStatsCache.deleteMany({});
    await prisma.faction_stats_snapshot.deleteMany({});
    
    // 初始化空数据 (可选)
    await prisma.factionStatsCache.create({
        data: {
            red_area: 0,
            blue_area: 0
        }
    });
    console.log('✅ 阵营统计已重置');

    console.log('[4/6] 重置俱乐部领地统计 (club_territory_stats / clubs.total_area)...');
    // clubs 表也有 total_area 字段
    await prisma.clubs.updateMany({
        data: {
            total_area: 0,
            territory: "0"
        }
    });
    
    // club_territory_stats 如果是关联表也需要清理
    try {
        await (prisma as any).club_territory_stats.deleteMany({});
    } catch (e) {
        console.log('ℹ️ club_territory_stats 表不存在或模型定义不同，建议检查 schema');
    }
    console.log('✅ 俱乐部统计已重置');

    console.log('[5/6] 重置所有用户总面积 (profiles.total_area)...');
    await prisma.profiles.updateMany({
        data: {
            total_area: 0
        }
    });
    console.log('✅ 用户总面积已重置为 0');

    console.log('[6/6] 清理地图省份统计 (ProvinceStat)...');
    await prisma.provinceStat.deleteMany({});
    console.log('✅ 省份统计已清理');

    console.log('\n✨ [SUCCESS] 所有脏数据已清理完毕！');
    console.log('提示：用户账号、俱乐部本体、跑步记录 (runs) 已保留。');
}

main()
    .catch((e) => {
        console.error('❌ 清理失败:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
