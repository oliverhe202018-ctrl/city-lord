import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandler, successResponse } from '@/lib/api/with-handler';

export const POST = withErrorHandler(async (req: Request) => {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const userId = user.id;

    const { batch } = await req.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      return successResponse({ syncedIds: [] });
    }

    const runId = batch[0]?.runId;
    if (!runId) {
      return Response.json({ error: 'runId required in batch items' }, { status: 400 });
    }

    // 批量更新轨迹点到 runs.path 字段（JSON 数组）
    const run = await prisma.runs.findUnique({
      where: { id: runId },
      select: { path: true }
    });

    if (!run) {
      return Response.json({ error: 'Run not found' }, { status: 404 });
    }

    const existingPath = Array.isArray(run.path) ? run.path : [];
    const newPoints = batch.map((pt: any) => ({
      lat: pt.lat,
      lng: pt.lng,
      timestamp: pt.timestamp,
      accuracy: pt.accuracy ?? null,
      sequenceId: pt.sequenceId,
    }));

    const mergedPath = [...existingPath, ...newPoints];

    await prisma.runs.update({
      where: { id: runId },
      data: { path: mergedPath }
    });

    return successResponse({
      syncedIds: batch.map((pt: any) => pt.sequenceId),
    });
});
