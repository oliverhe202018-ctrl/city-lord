import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Read from Cache - NO Aggregation here
    const stats = await prisma.factionStatsCache.findUnique({
      where: { id: 1 },
      select: {
        red_area: true,
        blue_area: true,
        updated_at: true,
      },
    });

    if (!stats) {
      // Defensive fallback
      return NextResponse.json({
        red_area: 0,
        blue_area: 0,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching faction stats:', error);
    // Return fallback on error to prevent UI crash
    return NextResponse.json({
      red_area: 0,
      blue_area: 0,
      updated_at: new Date().toISOString(),
    });
  }
}
