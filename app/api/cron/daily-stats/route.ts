import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    // [P6] Fail-closed: CRON_SECRET 未配置时直接 503
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Cron disabled: CRON_SECRET not configured' }, { status: 503 });
    }
    // 1. Security Check
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Count Territories
    // Note: Faction names are 'Red' and 'Blue' in the database profiles
    const red_count = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'Red',
        },
      },
    });

    const blue_count = await prisma.territories.count({
      where: {
        profiles: {
          faction: 'Blue',
        },
      },
    });

    const total_territories = await prisma.territories.count();

    // 3. Write to DailyStat
    // Normalize date to midnight to ensure one entry per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stat = await prisma.daily_stats.upsert({
      where: {
        date: today,
      },
      update: {
        red_count,
        blue_count,
        total_territories,
      },
      create: {
        date: today,
        red_count,
        blue_count,
        total_territories,
      },
    });

    return NextResponse.json({ success: true, data: stat });
  } catch (error) {
    console.error('Daily Stats Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
