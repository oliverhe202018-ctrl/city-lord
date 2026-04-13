import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const pendingRuns = await prisma.runs.findMany({
            where: {
                user_id: user.id,
                status: 'settling',
            },
            select: {
                id: true,
                polygons: true,
                created_at: true,
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // Some legacy runs might not have valid polygons array, ensure robust typing
        const sanitizedRuns = pendingRuns.map(run => ({
            id: run.id,
            polygons: Array.isArray(run.polygons) ? run.polygons : [],
            created_at: run.created_at
        }));

        return NextResponse.json({ runs: sanitizedRuns });
    } catch (error) {
        console.error('[PendingRuns] Error fetching pending runs:', error);
        return NextResponse.json({ error: 'Failed to fetch pending runs' }, { status: 500 });
    }
}
