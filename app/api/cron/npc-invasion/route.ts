import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 固定的 NPC ID (UUID 格式，符合数据库主键规范)
const GHOST_NPC_ID = '00000000-0000-0000-0000-000000000001';
const GHOST_NPC_FACTION = '暗影虫群';

export async function POST(request: Request) {
    try {
        // 1. 鉴权: 严格校验 Authorization Header
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // 2. 时间计算: 找出 7 天前的时间点
        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        console.log(`[NPC Invasion] Running at ${now.toISOString()}`);
        console.log(`[NPC Invasion] Looking for territories maintained before ${sevenDaysAgo.toISOString()}`);

        // 3. Prisma 查询: 查找超过 7 天未维护且不属于 NPC 的领地
        // 同时包含 last_maintained_at 为 null 的领地（视为从未维护）
        const targets = await prisma.territories.findMany({
            where: {
                OR: [
                    { last_maintained_at: { lt: sevenDaysAgo } },
                    { last_maintained_at: null }
                ],
                owner_id: { not: GHOST_NPC_ID },
            },
            take: 50,
        });

        console.log(`[NPC Invasion] Found ${targets.length} targets for invasion.`);

        if (targets.length === 0) {
            console.log(`[NPC Invasion] No eligible territories found.`);
            return NextResponse.json({ 
                message: "No territories to invade",
                timestamp: now.toISOString(),
                criteria: { sevenDaysAgo: sevenDaysAgo.toISOString() }
            });
        }

        // 4. 原子操作 (Transaction)
        const result = await prisma.$transaction(async (tx) => {
            console.log(`[NPC Invasion] Starting transaction for ${targets.length} territories...`);
            
            // 确保 NPC Profile 存在
            await tx.profiles.upsert({
                where: { id: GHOST_NPC_ID },
                update: {
                    faction: GHOST_NPC_FACTION,
                    nickname: 'Shadow Swarm'
                },
                create: {
                    id: GHOST_NPC_ID,
                    nickname: 'Shadow Swarm',
                    faction: GHOST_NPC_FACTION,
                }
            });

            let indexedCount = 0;
            // 批量处理更新领地和插入事件
            for (const target of targets) {
                indexedCount++;
                console.log(`[NPC Invasion] [${indexedCount}/50] Invading ${target.id} (Owner: ${target.owner_id || 'null'})`);
                
                await tx.territories.update({
                    where: { id: target.id },
                    data: {
                        owner_id: GHOST_NPC_ID,
                        owner_faction: GHOST_NPC_FACTION,
                        last_maintained_at: new Date(),
                        // @ts-ignore
                        status: 'ACTIVE', 
                    }
                });

                await tx.territory_events.create({
                    data: {
                        territory_id: target.id,
                        // @ts-ignore
                        event_type: 'OWNER_CHANGED',
                        event_type_old: 'OWNER_CHANGED', // 必填字段，兼容旧版本
                        new_owner_id: GHOST_NPC_ID,
                        new_faction: GHOST_NPC_FACTION,
                        old_owner_id: target.owner_id,
                        old_faction: target.owner_faction,
                        payload_json: {
                            message: "该领地因长期无人驻守，已被暗影虫群吞噬！",
                            reason: "maintenance_timeout"
                        }
                    }
                });
            }
            console.log(`[NPC Invasion] Transaction completed successfully.`);
            return targets.length;
        });

        return NextResponse.json({ 
            success: true, 
            processed_count: result,
            message: `Successfully invaded ${result} territories.` 
        });

    } catch (error: any) {
        console.error('[NPC Invasion Cron Error]:', error);
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' }, 
            { status: 500 }
        );
    }
}
