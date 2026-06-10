import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { withErrorHandler, successResponse } from '@/lib/api/with-handler';
import { AppError, ErrorCode } from '@/lib/api/errors';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new AppError(ErrorCode.AUTH_UNAUTHORIZED, "Unauthorized");
  }

  const activeRun = await prisma.runs.findFirst({
    where: {
      user_id: user.id,
      status: 'active'
    },
    orderBy: { updated_at: 'desc' }
  });

  if (!activeRun) {
    return successResponse({ active: false });
  }

  const startTime = activeRun.created_at ? new Date(activeRun.created_at).getTime() : Date.now();
  const duration = Math.floor((Date.now() - startTime) / 1000);

  return successResponse({
    active: true,
    run: {
      ...activeRun,
      duration: duration
    }
  });
});
