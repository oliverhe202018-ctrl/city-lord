import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor') ?? undefined;
    const limit = 20;

    const runs = await prisma.runs.findMany({
      where: { user_id: user.id, status: 'completed' },
      orderBy: { created_at: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        distance: true,
        duration: true,
        total_steps: true,
        idempotency_key: true,
        created_at: true,
      }
    });

    const hasMore = runs.length > limit;
    const items = hasMore ? runs.slice(0, limit) : runs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const formatted = items.map(r => {
      const distanceKm = (r.distance ?? 0) / 1000;
      const durationSec = r.duration ?? 0;
      const hrs = Math.floor(durationSec / 3600);
      const mins = Math.floor((durationSec % 3600) / 60);
      const secs = durationSec % 60;
      const durationStr = hrs > 0
        ? `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`
        : `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      const paceRaw = distanceKm > 0 ? Math.round(durationSec / distanceKm) : 0;
      const paceMin = Math.floor(paceRaw / 60);
      const paceSec = paceRaw % 60;

      return {
        id: r.id,
        idempotencyKey: r.idempotency_key,
        distanceKm: Math.round(distanceKm * 100) / 100,
        durationStr,
        paceMinPerKm: `${paceMin}'${String(paceSec).padStart(2,'0')}"`,
        calories: 0,
        createdAt: r.created_at?.toISOString() ?? '',
      };
    });

    return NextResponse.json({ success: true, data: { runs: formatted, nextCursor } });
  } catch (err: any) {
    console.error('[GET /api/v1/runs/history]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
