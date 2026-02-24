import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateFactionBalance } from '@/utils/faction-balance';

/**
 * GET /api/faction/balance-config
 * 
 * Returns the current faction balance configuration and calculated buff percentage.
 * This powers the dynamic buff display in the FactionComparison component.
 */
export async function GET() {
    try {
        // Fetch latest faction stats snapshot
        const snapshot = await prisma.faction_stats_snapshot.findFirst({
            orderBy: { updated_at: 'desc' },
        });

        const redArea = snapshot?.red_area ?? 0;
        const blueArea = snapshot?.blue_area ?? 0;

        // Calculate dynamic balance using the same logic as server-side claim
        const {
            underdog,
            multiplier,
            diffRatio,
        } = calculateFactionBalance(redArea, blueArea);

        // Convert multiplier to buff percentage: 1.5x → 50%
        const buffPercentage = Math.round((multiplier - 1) * 100);

        return NextResponse.json({
            redArea,
            blueArea,
            underdog,          // 'red' | 'blue' | null
            multiplier,        // e.g. 1.5
            buffPercentage,    // e.g. 50
            diffRatio,         // e.g. 0.25
            imbalanceThreshold: 20,  // expose config defaults
            underdogMultiplier: 1.5,
            updatedAt: snapshot?.updated_at ?? null,
        });
    } catch (error) {
        console.error('API Error [balance-config]:', error);
        return NextResponse.json(
            { error: 'Failed to fetch balance config' },
            { status: 500 }
        );
    }
}
