import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const WINNER_COINS = 50;
const WINNER_XP = 100;
const LOSER_COINS = 20;
const LOSER_XP = 50;
const TIE_COINS = 30;
const TIE_XP = 75;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const today = new Date();
    const settlementDate = today.toISOString().split('T')[0];

    try {
      await prisma.faction_settlement_logs.create({
        data: {
          settlement_date: settlementDate,
          winner: 'pending',
          red_area: 0,
          blue_area: 0,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return NextResponse.json({
          success: false,
          error: `Settlement already executed for ${settlementDate}`,
        });
      }
      throw err;
    }

    const snapshot = await prisma.faction_stats_snapshot.findFirst({
      orderBy: { updated_at: 'desc' },
    });

    if (!snapshot) {
      await prisma.faction_settlement_logs.update({
        where: { settlement_date: settlementDate },
        data: { winner: 'error_no_snapshot' },
      });
      return NextResponse.json({
        success: false,
        error: 'No faction_stats_snapshot found',
      });
    }

    const { red_area: redArea, blue_area: blueArea } = snapshot;
    const winner = redArea > blueArea ? 'Red' : blueArea > redArea ? 'Blue' : null;
    const loser = winner ? (winner === 'Red' ? 'Blue' : 'Red') : null;
    const isTie = !winner;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUserIds = await prisma.runs.findMany({
      where: { created_at: { gte: twentyFourHoursAgo } },
      select: { user_id: true },
      distinct: ['user_id'],
    });
    const activeIds = activeUserIds.map((r) => r.user_id).filter((id): id is string => !!id);

    if (activeIds.length === 0) {
      await prisma.faction_settlement_logs.update({
        where: { settlement_date: settlementDate },
        data: { winner: 'no_active_users', red_area: redArea, blue_area: blueArea },
      });
      return NextResponse.json({
        success: true,
        message: 'No active users in last 24h',
        redArea,
        blueArea,
        winner,
        rewardedUsers: 0,
      });
    }

    let winnerCount = 0;
    let loserCount = 0;

    if (isTie) {
      const tieResult = await prisma.profiles.updateMany({
        where: {
          id: { in: activeIds },
          faction: { in: ['Red', 'Blue'] },
        },
        data: {
          coins: { increment: TIE_COINS },
          xp: { increment: TIE_XP },
        },
      });
      winnerCount = tieResult.count;

      await prisma.reward_logs.createMany({
        data: activeIds
        .filter((id) => true)
        .map((uid) => ({
          user_id: uid,
          coins: TIE_COINS,
          exp: TIE_XP,
          source: 'faction_settlement_tie',
          reference_id: `tie-${settlementDate}`,
        })),
        skipDuplicates: true,
      });
    } else if (winner && loser) {
      const winnerResult = await prisma.profiles.updateMany({
        where: { id: { in: activeIds }, faction: winner },
        data: {
          coins: { increment: WINNER_COINS },
          xp: { increment: WINNER_XP },
        },
      });
      winnerCount = winnerResult.count;

      const winnerIds = await prisma.profiles.findMany({
        where: { id: { in: activeIds }, faction: winner },
        select: { id: true },
      });
      if (winnerIds.length > 0) {
        await prisma.reward_logs.createMany({
          data: winnerIds.map((p) => ({
            user_id: p.id,
            coins: WINNER_COINS,
            exp: WINNER_XP,
            source: 'faction_settlement_winner',
            reference_id: `winner-${settlementDate}`,
          })),
          skipDuplicates: true,
        });
      }

      const loserResult = await prisma.profiles.updateMany({
        where: { id: { in: activeIds }, faction: loser },
        data: {
          coins: { increment: LOSER_COINS },
          xp: { increment: LOSER_XP },
        },
      });
      loserCount = loserResult.count;

      const loserIds = await prisma.profiles.findMany({
        where: { id: { in: activeIds }, faction: loser },
        select: { id: true },
      });
      if (loserIds.length > 0) {
        await prisma.reward_logs.createMany({
          data: loserIds.map((p) => ({
            user_id: p.id,
            coins: LOSER_COINS,
            exp: LOSER_XP,
            source: 'faction_settlement_underdog',
            reference_id: `underdog-${settlementDate}`,
          })),
          skipDuplicates: true,
        });
      }
    }

    await prisma.faction_settlement_logs.update({
      where: { settlement_date: settlementDate },
      data: {
        winner: isTie ? 'Tie' : winner!,
        red_area: redArea,
        blue_area: blueArea,
        winner_coins: isTie ? TIE_COINS : WINNER_COINS,
        winner_xp: isTie ? TIE_XP : WINNER_XP,
        loser_coins: LOSER_COINS,
        loser_xp: LOSER_XP,
        winner_count: winnerCount,
        loser_count: loserCount,
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      settlementDate,
      redArea,
      blueArea,
      winner: isTie ? 'Tie' : winner,
      winnerCount,
      loserCount,
      totalRewarded: winnerCount + loserCount,
    });
  } catch (error) {
    console.error('[cron/faction-settlement] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
