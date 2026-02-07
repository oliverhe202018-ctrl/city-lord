import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { HEX_AREA_SQ_METERS } from '@/lib/citylord/area-utils';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Calculate Red Area
    // We count territories owned by RED faction users
    const redCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'red', // Database stores lowercase 'red'
        },
      },
    });

    // Calculate Blue Area
    const blueCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'blue', // Database stores lowercase 'blue'
        },
      },
    });

    const redArea = redCount * HEX_AREA_SQ_METERS;
    const blueArea = blueCount * HEX_AREA_SQ_METERS;

    // Upsert Cache (ID 'latest' for singleton)
    const stats = await prisma.faction_stats_snapshot.upsert({
      where: { id: 'latest' },
      update: {
        red_area: redArea,
        blue_area: blueArea,
        updated_at: new Date(),
      },
      create: {
        id: 'latest',
        red_area: redArea,
        blue_area: blueArea,
        updated_at: new Date(),
      },
    });

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error updating faction stats:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
