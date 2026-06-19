import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const TOP_N = 50;

function getBeijingDate(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijing = new Date(utc + 8 * 3600000);
  return new Date(Date.UTC(beijing.getFullYear(), beijing.getMonth(), beijing.getDate()));
}

async function snapshotDistrict(snapshotDate: Date) {
  const rows = await prisma.$queryRaw<
    { user_id: string; district_code: string; total_area: number; nickname: string | null; avatar_url: string | null; rn: bigint }[]
  >`
    SELECT user_id, district_code, total_area, nickname, avatar_url, rn
    FROM (
      SELECT
        p.id AS user_id,
        p.district_code,
        p.total_area,
        p.nickname,
        p.avatar_url,
        ROW_NUMBER() OVER (PARTITION BY p.district_code ORDER BY p.total_area DESC) AS rn
      FROM profiles p
      WHERE p.is_active = true
        AND p.district_code IS NOT NULL
        AND p.total_area > 0
    ) ranked
    WHERE rn <= ${TOP_N}
  `;

  const inserts = rows.map((row) => ({
    snapshot_date: snapshotDate,
    scope: 'district',
    scope_code: row.district_code,
    rank: Number(row.rn),
    user_id: row.user_id,
    total_area: Number(row.total_area),
    nickname: row.nickname,
    avatar_url: row.avatar_url,
  }));

  if (inserts.length === 0) return 0;

  await prisma.$transaction(
    inserts.map((item) =>
      prisma.leaderboard_snapshots.upsert({
        where: {
          snapshot_date_scope_scope_code_rank: {
            snapshot_date: item.snapshot_date,
            scope: item.scope,
            scope_code: item.scope_code,
            rank: item.rank,
          },
        },
        create: item,
        update: item,
      })
    )
  );

  return inserts.length;
}

async function snapshotProvince(snapshotDate: Date) {
  const rows = await prisma.$queryRaw<
    { province_code: string; total_area: number; rn: bigint }[]
  >`
    SELECT province_code, total_area, rn
    FROM (
      SELECT
        p.province_code,
        SUM(p.total_area) AS total_area,
        ROW_NUMBER() OVER (ORDER BY SUM(p.total_area) DESC) AS rn
      FROM profiles p
      WHERE p.is_active = true
        AND p.province_code IS NOT NULL
      GROUP BY p.province_code
    ) ranked
    WHERE rn <= ${TOP_N}
  `;

  const inserts = rows.map((row) => ({
    snapshot_date: snapshotDate,
    scope: 'province',
    scope_code: row.province_code,
    rank: Number(row.rn),
    user_id: null,
    total_area: Number(row.total_area),
    nickname: null,
    avatar_url: null,
  }));

  if (inserts.length === 0) return 0;

  await prisma.$transaction(
    inserts.map((item) =>
      prisma.leaderboard_snapshots.upsert({
        where: {
          snapshot_date_scope_scope_code_rank: {
            snapshot_date: item.snapshot_date,
            scope: item.scope,
            scope_code: item.scope_code,
            rank: item.rank,
          },
        },
        create: item,
        update: item,
      })
    )
  );

  return inserts.length;
}

async function snapshotGlobal(snapshotDate: Date) {
  const rows = await prisma.profiles.findMany({
    where: { is_active: true, total_area: { gt: 0 } },
    orderBy: { total_area: 'desc' },
    take: TOP_N,
    select: { id: true, total_area: true, nickname: true, avatar_url: true },
  });

  const inserts = rows.map((row, index) => ({
    snapshot_date: snapshotDate,
    scope: 'global',
    scope_code: 'global', // Use 'global' instead of null for unique constraint
    rank: index + 1,
    user_id: row.id,
    total_area: row.total_area ?? 0,
    nickname: row.nickname,
    avatar_url: row.avatar_url,
  }));

  if (inserts.length === 0) return 0;

  await prisma.$transaction(
    inserts.map((item) =>
      prisma.leaderboard_snapshots.upsert({
        where: {
          snapshot_date_scope_scope_code_rank: {
            snapshot_date: item.snapshot_date,
            scope: item.scope,
            scope_code: item.scope_code,
            rank: item.rank,
          },
        },
        create: item,
        update: item,
      })
    )
  );

  return inserts.length;
}

export async function GET(request: NextRequest) {
  // [P6] Fail-closed: CRON_SECRET 未配置时直接 503
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Cron disabled: CRON_SECRET not configured' }, { status: 503 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const snapshotDate = getBeijingDate();
    console.log(`[leaderboard-snapshot] Generating snapshots for ${snapshotDate.toISOString()}`);

    const districtCount = await snapshotDistrict(snapshotDate);
    const provinceCount = await snapshotProvince(snapshotDate);
    const globalCount = await snapshotGlobal(snapshotDate);

    return NextResponse.json({
      success: true,
      date: snapshotDate.toISOString(),
      counts: { district: districtCount, province: provinceCount, global: globalCount },
    });
  } catch (error: any) {
    console.error('[leaderboard-snapshot] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
