import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
    try {
        // 1. Security Check
        const authHeader = request.headers.get('Authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const now = new Date();
        let totalCleaned = 0;

        // Loop until no more expired pending invitations are found
        while (true) {
            // Fetch next batch of expired and pending invitations
            const expiredInvitations = await prisma.friend_invitations.findMany({
                where: {
                    status: 'pending',
                    expired_at: { lt: now },
                },
                select: { id: true },
                orderBy: { expired_at: 'asc' },
                take: 1000, // Batch limit
            });

            if (expiredInvitations.length === 0) {
                break; // No more rows to clean
            }

            const expiredIds = expiredInvitations.map((invite) => invite.id);

            // Soft cleanup: update status to 'expired'
            const result = await prisma.friend_invitations.updateMany({
                where: {
                    id: { in: expiredIds },
                },
                data: {
                    status: 'expired',
                    expired_cleaned_at: now,
                },
            });

            totalCleaned += result.count;

            // Safety break if update logic fails to clear the pending status
            if (result.count === 0) {
                console.warn('[Cron: Cleanup Invitations] Safety break triggered; found rows but update count was 0.');
                break;
            }
        }

        if (totalCleaned > 0) {
            console.log(`[Cron: Cleanup Invitations] Cleaned total of ${totalCleaned} expired invitations.`);
        } else {
            console.log(`[Cron: Cleanup Invitations] No expired invitations to clean.`);
        }

        // Response excludes count for security against reconnaissance
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[Cron: Cleanup Invitations] Error:', error);
        return NextResponse.json({ ok: false }, { status: 500 });
    }
}
