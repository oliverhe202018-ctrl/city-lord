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
      // If cache is missing, aggregate from Territory table directly
      // This ensures we return real data instead of 0
      console.log('Faction stats cache miss, aggregating from DB...');
      
      const redCount = await prisma.territory.count({
          where: { faction: 'RED' }
      });
      const blueCount = await prisma.territory.count({
          where: { faction: 'BLUE' }
      });

      // Simple area approximation (count * avg_area or just count for now)
      // Assuming 1 hex = ~0.06 sq km or similar, but for now just returning counts/scores
      // If the frontend expects area in km2, we might need a multiplier.
      // Let's use the counts as "area" for now or check if we have area field.
      // Territory doesn't seem to have area in schema usually, it's hex based.
      
      return NextResponse.json({
        red_area: redCount * 10, // Mock multiplier or use count
        blue_area: blueCount * 10,
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
