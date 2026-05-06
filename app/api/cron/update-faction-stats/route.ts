import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
          faction: 'Red',
        },
      },
    });

    // Calculate Blue Area
    const blueCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'Blue',
        },
      },
    });

    const [redAreaAggregate, blueAreaAggregate] = await Promise.all([
      prisma.territories.aggregate({
        where: { profiles: { faction: 'Red' } },
        _sum: { area_m2_exact: true },
      }),
      prisma.territories.aggregate({
        where: { profiles: { faction: 'Blue' } },
        _sum: { area_m2_exact: true },
      }),
    ]);

    const redArea = redAreaAggregate._sum.area_m2_exact || 0;
    const blueArea = blueAreaAggregate._sum.area_m2_exact || 0;

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
