import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/api/auth-helper';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { userId, error } = await getUserFromRequest(req);
    if (error || !userId) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { batch } = await req.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ success: true, syncedIds: [] });
    }

    const runId = batch[0]?.runId;
    if (!runId) {
      return NextResponse.json({ error: 'runId required in batch items' }, { status: 400 });
    }

    // 批量 upsert 轨迹点（幂等）
    await prisma.run_trajectory_points.createMany({
      data: batch.map((pt: any) => ({
        run_id: runId,
        sequence_id: pt.sequenceId,
        lat: pt.lat,
        lng: pt.lng,
        accuracy: pt.accuracy ?? null,
        recorded_at: new Date(pt.timestamp),
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      syncedIds: batch.map((pt: any) => pt.sequenceId),
    });
  } catch (err: any) {
    console.error('[POST /api/v1/runs/sync]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
