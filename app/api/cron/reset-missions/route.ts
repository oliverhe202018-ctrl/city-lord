import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getDailyPeriodKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getWeeklyPeriodKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

export async function GET(request: Request) {
  try {
    // [P6] Fail-closed: CRON_SECRET 未配置时直接 503
    if (!process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Cron disabled: CRON_SECRET not configured' }, { status: 503 });
    }
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const now = new Date();
    const dailyKey = getDailyPeriodKey(now);
    const weeklyKey = getWeeklyPeriodKey(now);

    const dailyMissions = await prisma.missions.findMany({
      where: { frequency: 'daily' },
      select: { id: true, title: true },
    });

    const weeklyMissions = await prisma.missions.findMany({
      where: { frequency: 'weekly' },
      select: { id: true, title: true },
    });

    const dailyMissionIds = dailyMissions.map((m) => m.id);
    const weeklyMissionIds = weeklyMissions.map((m) => m.id);

    let dailyResetCount = 0;
    let weeklyResetCount = 0;

    if (dailyMissionIds.length > 0) {
      const result = await prisma.user_missions.updateMany({
        where: {
          mission_id: { in: dailyMissionIds },
          OR: [
            { status: 'completed' },
            { status: 'in-progress' },
          ],
        },
        data: {
          status: 'in-progress',
          progress: 0,
          period_key: dailyKey,
          claimed_at: null,
          updated_at: now,
        },
      });
      dailyResetCount = result.count;
    }

    if (weeklyMissionIds.length > 0) {
      const result = await prisma.user_missions.updateMany({
        where: {
          mission_id: { in: weeklyMissionIds },
          OR: [
            { status: 'completed' },
            { status: 'in-progress' },
          ],
        },
        data: {
          status: 'in-progress',
          progress: 0,
          period_key: weeklyKey,
          claimed_at: null,
          updated_at: now,
        },
      });
      weeklyResetCount = result.count;
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      dailyPeriodKey: dailyKey,
      weeklyPeriodKey: weeklyKey,
      dailyMissionsReset: dailyResetCount,
      weeklyMissionsReset: weeklyResetCount,
    });
  } catch (error) {
    console.error('[cron/reset-missions] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
