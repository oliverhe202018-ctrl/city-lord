import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // 1. Security Check
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const now = Date.now();
        const hotCutoffDate = new Date(now - 72 * 60 * 60 * 1000);
        const normalCutoffDate = new Date(now - 48 * 60 * 60 * 1000);
        let cleanedCount = 0;

        // 2. Fetch all hot territories
        const hotTerritories = await prisma.territories.findMany({
            where: {
                owner_change_count: { gte: 2 }
            },
            select: { id: true },
        });
        const hotIds = hotTerritories.map(t => t.id);

        // 3. Batch delete expired logs for Hot Zones (> 72h)
        if (hotIds.length > 0) {
            // Prisma "in" can handle thousands of IDs.
            // If it exceeds limits, we chunk it.
            const CHUNK_SIZE = 500;
            for (let i = 0; i < hotIds.length; i += CHUNK_SIZE) {
                const chunk = hotIds.slice(i, i + CHUNK_SIZE);
                const hotResult = await prisma.territory_hp_logs.deleteMany({
                    where: {
                        territory_id: { in: chunk },
                        created_at: { lt: hotCutoffDate },
                    },
                });
                cleanedCount += hotResult.count;
                if (hotResult.count > 0) {
                    console.log(`Cleaned ${hotResult.count} expired logs for hot zones (chunk ${i / CHUNK_SIZE + 1}).`);
                }
            }
        }

        // 4. Batch delete expired logs for Normal Zones (> 48h)
        // Since we chunked hotIds, for normal zones we can delete by NOT IN hotIds.
        // Or safely, just do a raw SQL to avoid massive NOT IN array if needed.
        // However, Prisma deleteMany with NOT IN should be reasonably safe for typically sized DBs.
        // We can just rely on Prisma for now.
        const normalResult = await prisma.territory_hp_logs.deleteMany({
            where: {
                ...(hotIds.length > 0 ? { territory_id: { notIn: hotIds } } : {}),
                created_at: { lt: normalCutoffDate },
            }
        });

        cleanedCount += normalResult.count;
        if (normalResult.count > 0) {
            console.log(`Cleaned ${normalResult.count} expired logs for normal zones.`);
        }

        return NextResponse.json({ success: true, message: `Cleaned ${cleanedCount} expired hp logs.` });
    } catch (error) {
        console.error('Territory Decay Cron Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
