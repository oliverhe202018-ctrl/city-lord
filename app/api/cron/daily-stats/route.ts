import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // 1. Security Check
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Count Territories
    // Note: Faction names are 'Red' and 'Blue' in the database profiles
    const redCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'Red',
        },
      },
    });

    const blueCount = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'Blue',
        },
      },
    });

    const totalTerritories = await prisma.territories.count();

    // 3. Write to DailyStat
    // Normalize date to midnight to ensure one entry per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stat = await prisma.dailyStat.upsert({
      where: {
        date: today,
      },
      update: {
        redCount,
        blueCount,
        totalTerritories,
      },
      create: {
        date: today,
        redCount,
        blueCount,
        totalTerritories,
      },
    });

    return NextResponse.json({ success: true, data: stat });
  } catch (error) {
    console.error('Daily Stats Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
